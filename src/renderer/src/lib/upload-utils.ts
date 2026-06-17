import { toast } from '@heroui/react/toast'
import { addFileItemToStore, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { generateThumbnail, generateAllPdfPageThumbnails } from '@renderer/lib/thumbnail-generator'
import { saveThumbnail, savePdfPageThumbs } from '@renderer/lib/thumbnail-db'
import { isWeb } from '@renderer/lib/env'
import {
  canGenerateMediaThumbnail,
  classifyFile,
  resolveMediaCapability,
  type ClassifiedFile,
  type MediaPlatform
} from '@renderer/lib/media-capabilities'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import { getFileBlob, getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { resolveUniqueName } from '@renderer/lib/file-naming'
import { enqueueTranscodeJob } from '@renderer/lib/media-transcode-lifecycle'
import { ensureSourceMediaMetadata } from '@renderer/lib/media-metadata'
import { enqueueVideoPosterJob } from '@renderer/lib/video-poster-jobs'
import { MAX_FILE_SIZE_WEB } from '@renderer/lib/media-limits'

export { MAX_FILE_SIZE_WEB }

interface UploadCandidate {
  file: File
  classification: ClassifiedFile
}

interface UploadDestination extends UploadCandidate {
  parentId: string
}

function createSemaphore(limit: number): { acquire(): Promise<() => void> } {
  let active = 0
  const queue: Array<() => void> = []
  return {
    acquire(): Promise<() => void> {
      return new Promise((resolve) => {
        const tryAcquire = (): void => {
          if (active < limit) {
            active++
            resolve(() => {
              active--
              queue.shift()?.()
            })
          } else {
            queue.push(tryAcquire)
          }
        }
        tryAcquire()
      })
    }
  }
}

const UPLOAD_CONCURRENCY = 3
const uploadSemaphore = createSemaphore(UPLOAD_CONCURRENCY)
const pendingPdfFiles = new Map<string, File>()

export function getUploadMediaPlatform(): MediaPlatform {
  return isWeb() ? 'web' : 'electron'
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []
  const readBatch = (): Promise<void> =>
    new Promise((resolve, reject) => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve()
        } else {
          all.push(...entries)
          readBatch().then(resolve, reject)
        }
      }, reject)
    })
  await readBatch()
  return all
}

async function collectFromEntry(
  entry: FileSystemEntry,
  prefix = ''
): Promise<{ file: File; relativePath: string }[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      ;(entry as FileSystemFileEntry).file(resolve, reject)
    })
    return [{ file, relativePath: prefix ? `${prefix}/${entry.name}` : entry.name }]
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const children = await readAllEntries(reader)
    const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
    const nested = await Promise.all(children.map((child) => collectFromEntry(child, newPrefix)))
    return nested.flat()
  }
  return []
}

export function isSupportedFile(file: File): boolean {
  return classifyFile(file, getUploadMediaPlatform()).kind !== 'unsupported'
}

export function canGenerateThumbnail(mimeType: string, fileName?: string): boolean {
  return canGenerateMediaThumbnail(resolveMediaCapability({ mimeType, fileName }))
}

async function hasWebStorageCapacity(files: File[]): Promise<boolean> {
  if (!isWeb() || !navigator.storage?.estimate) return true

  try {
    const { quota, usage } = await navigator.storage.estimate()
    if (quota === undefined) return true
    const available = Math.max(0, quota - (usage ?? 0))
    return files.reduce((total, file) => total + file.size, 0) <= available
  } catch {
    return true
  }
}

async function prepareUploadCandidates(files: File[]): Promise<UploadCandidate[]> {
  const candidates: UploadCandidate[] = []
  const platform = getUploadMediaPlatform()
  for (const file of files) {
    const classification = classifyFile(file, platform)
    if (classification.kind === 'unsupported') continue
    if (isWeb() && file.size > MAX_FILE_SIZE_WEB) {
      toast.danger(`File "${file.name}" exceeds 2GB limit`)
      continue
    }
    candidates.push({ file, classification })
  }

  if (!(await hasWebStorageCapacity(candidates.map((candidate) => candidate.file)))) {
    toast.danger('The selected files exceed available browser storage')
    return []
  }
  return candidates
}

async function loadPdfJobFile(sourceBlobId: string, itemId: string): Promise<File | null> {
  const db = await openFileExplorerDB()
  const item = await db.get('folder-items', itemId)
  if (!item || item.type !== 'file') return null

  const blob = await getFileBlob(db, sourceBlobId)
  if (blob) return new File([blob], item.name, { type: item.mimeType })

  const source = await getFileSource(db, sourceBlobId, item.mimeType)
  if (!source) return null
  try {
    const response = await fetch(source.url)
    if (!response.ok) throw new Error(`Failed to read PDF source: ${response.status}`)
    return new File([await response.blob()], item.name, { type: item.mimeType })
  } finally {
    source.revoke()
  }
}

mediaJobQueue.registerExecutor('pdf-pages', async (job, { signal }) => {
  if (!job.sourceBlobId || !job.itemId) throw new Error('PDF page job is missing source identity')
  try {
    const file =
      pendingPdfFiles.get(job.sourceBlobId) ?? (await loadPdfJobFile(job.sourceBlobId, job.itemId))
    if (!file) throw new Error('PDF source is unavailable')
    const dataUrls = await generateAllPdfPageThumbnails(file, { signal, throwOnError: true })
    if (dataUrls.length > 0) await savePdfPageThumbs(job.sourceBlobId, dataUrls)
  } finally {
    pendingPdfFiles.delete(job.sourceBlobId)
  }
})

async function uploadPreparedFiles(destinations: UploadDestination[]): Promise<number> {
  let uploadedCount = 0
  await Promise.all(
    destinations.map(async ({ file, classification, parentId }) => {
      const release = await uploadSemaphore.acquire()
      let id: string | undefined
      try {
        id = await addFileItemToStore(file, parentId, classification.mimeType)
        uploadedCount++
        if (
          classification.kind === 'image' ||
          classification.kind === 'video' ||
          classification.kind === 'pdf'
        ) {
          void ensureSourceMediaMetadata(id, classification.mimeType).catch((error) => {
            console.warn('[media-metadata] Failed to store upload metadata', {
              blobId: id,
              error
            })
          })
        }
        if (canGenerateThumbnail(classification.mimeType, file.name)) {
          const dataUrl = await generateThumbnail(file, classification.mimeType)
          if (dataUrl) await saveThumbnail(id, dataUrl)
          window.dispatchEvent(
            new CustomEvent('hhc:thumbnail-ready', { detail: { itemId: id, dataUrl } })
          )
        }
      } finally {
        release()
      }

      if (id && classification.kind === 'pdf') {
        pendingPdfFiles.set(id, file)
        try {
          await mediaJobQueue.enqueue({
            type: 'pdf-pages',
            sourceBlobId: id,
            itemId: id,
            dedupeKey: `pdf-pages:${id}`
          })
        } catch (error) {
          pendingPdfFiles.delete(id)
          throw error
        }
      }

      if (id && classification.support === 'transcode-required') {
        await enqueueVideoPosterJob({
          sourceBlobId: id,
          itemId: id
        })
        await enqueueTranscodeJob({
          sourceBlobId: id,
          itemId: id
        })
      }
    })
  )
  return uploadedCount
}

export async function uploadFiles(files: File[], parentId: string): Promise<number> {
  const candidates = await prepareUploadCandidates(files)
  return uploadPreparedFiles(candidates.map((candidate) => ({ ...candidate, parentId })))
}

export async function uploadFolderFiles(
  allFiles: File[],
  currentFolderId: string,
  addFolder: (name: string, parentId: string) => string
): Promise<number> {
  const candidates = await prepareUploadCandidates(allFiles)
  if (candidates.length === 0) return 0

  const pathToFolderId = new Map<string, string>()
  const usedNamesByParent = new Map<string, Set<string>>()
  const store = useFileExplorerStore.getState()

  function reserveFolderName(parentId: string, requestedName: string): string {
    const usedNames =
      usedNamesByParent.get(parentId) ??
      new Set(store.getChildFolders(parentId).map((folder) => folder.name))
    const uniqueName = resolveUniqueName(requestedName, usedNames)
    usedNames.add(uniqueName)
    usedNamesByParent.set(parentId, usedNames)
    return uniqueName
  }

  for (const { file } of candidates) {
    const parts = file.webkitRelativePath.split('/')
    for (let depth = 1; depth < parts.length; depth++) {
      const folderPath = parts.slice(0, depth).join('/')
      if (!pathToFolderId.has(folderPath)) {
        const parentPath = parts.slice(0, depth - 1).join('/')
        const parentId =
          depth === 1 ? currentFolderId : (pathToFolderId.get(parentPath) ?? currentFolderId)
        const id = addFolder(reserveFolderName(parentId, parts[depth - 1]), parentId)
        pathToFolderId.set(folderPath, id)
      }
    }
  }

  const destinations = candidates.map((candidate) => {
    const parts = candidate.file.webkitRelativePath.split('/')
    const folderPath = parts.slice(0, parts.length - 1).join('/')
    return {
      ...candidate,
      parentId: pathToFolderId.get(folderPath) ?? currentFolderId
    }
  })
  return uploadPreparedFiles(destinations)
}

export async function uploadFolderFilesFromStore(
  allFiles: File[],
  currentFolderId: string
): Promise<number> {
  return uploadFolderFiles(allFiles, currentFolderId, useFileExplorerStore.getState().addFolder)
}

export async function uploadFromDataTransfer(
  items: DataTransferItemList,
  targetFolderId: string
): Promise<number> {
  const entries: FileSystemEntry[] = []
  for (let index = 0; index < items.length; index++) {
    const entry = items[index].webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }

  const filesWithPaths = (await Promise.all(entries.map((entry) => collectFromEntry(entry)))).flat()
  const candidates = await prepareUploadCandidates(filesWithPaths.map(({ file }) => file))
  if (candidates.length === 0) return 0

  const relativePaths = new Map(
    filesWithPaths.map(({ file, relativePath }) => [file, relativePath])
  )
  const { addFolder } = useFileExplorerStore.getState()
  const store = useFileExplorerStore.getState()
  const usedNamesByParent = new Map<string, Set<string>>()

  function reserveFolderName(parentId: string, requestedName: string): string {
    const usedNames =
      usedNamesByParent.get(parentId) ??
      new Set(store.getChildFolders(parentId).map((folder) => folder.name))
    const uniqueName = resolveUniqueName(requestedName, usedNames)
    usedNames.add(uniqueName)
    usedNamesByParent.set(parentId, usedNames)
    return uniqueName
  }

  const pathToFolderId = new Map<string, string>()

  for (const { file } of candidates) {
    const parts = (relativePaths.get(file) ?? file.name).split('/')
    for (let depth = 1; depth < parts.length; depth++) {
      const folderPath = parts.slice(0, depth).join('/')
      if (!pathToFolderId.has(folderPath)) {
        const parentPath = parts.slice(0, depth - 1).join('/')
        const parentId =
          depth === 1 ? targetFolderId : (pathToFolderId.get(parentPath) ?? targetFolderId)
        const id = addFolder(reserveFolderName(parentId, parts[depth - 1]), parentId)
        pathToFolderId.set(folderPath, id)
      }
    }
  }

  const destinations = candidates.map((candidate) => {
    const parts = (relativePaths.get(candidate.file) ?? candidate.file.name).split('/')
    const folderPath = parts.slice(0, parts.length - 1).join('/')
    return {
      ...candidate,
      parentId: folderPath ? (pathToFolderId.get(folderPath) ?? targetFolderId) : targetFolderId
    }
  })
  return uploadPreparedFiles(destinations)
}
