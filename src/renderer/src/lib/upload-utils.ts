import { toast } from '@heroui/react/toast'
import { addFileItemToStore, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { saveThumbnail } from '@renderer/lib/thumbnail-db'
import { isWeb } from '@renderer/lib/env'
import {
  canGenerateMediaThumbnail,
  resolveMediaCapability,
  type MediaKind,
  type MediaPlatform
} from '@renderer/lib/media-capabilities'
import { classifyMediaImport, type MediaImportDecision } from '@renderer/lib/media-import-policy'
import { resolveUniqueName } from '@renderer/lib/file-naming'
import { ensureSourceMediaMetadata } from '@renderer/lib/media-metadata'
import { enqueueVideoPosterJob } from '@renderer/lib/video-poster-jobs'
import { MAX_FILE_SIZE_WEB } from '@renderer/lib/media-limits'
import { isIgnoredSystemFile } from '@shared/file-ignore-policy'
import i18n from '@renderer/i18n'
import { ensurePdfPageJob } from '@renderer/lib/pdf-page-jobs'

export { MAX_FILE_SIZE_WEB }

type AcceptedMediaImportDecision = Extract<MediaImportDecision, { action: 'accept' }>

export interface UploadCandidate {
  file: File
  classification: AcceptedMediaImportDecision
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
  return classifyMediaImport(file, getUploadMediaPlatform()).action === 'accept'
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
  let unsupportedCount = 0
  for (const file of files) {
    if (isIgnoredSystemFile(file)) continue
    const classification = classifyMediaImport(file, platform)
    if (classification.action === 'skip') {
      if (classification.reason === 'app-unsupported') unsupportedCount++
      continue
    }
    if (classification.action === 'platform-unsupported') {
      unsupportedCount++
      continue
    }
    if (isWeb() && file.size > MAX_FILE_SIZE_WEB) {
      toast.danger(`File "${file.name}" exceeds 2GB limit`)
      continue
    }
    candidates.push({ file, classification })
  }

  if (unsupportedCount > 0) {
    toast.warning(i18n.t('fileExplorer.uploadSkippedUnsupported', { count: unsupportedCount }))
  }

  if (!(await hasWebStorageCapacity(candidates.map((candidate) => candidate.file)))) {
    toast.danger('The selected files exceed available browser storage')
    return []
  }
  return candidates
}

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
          void ensureSourceMediaMetadata(id, classification.mimeType)
            .catch((error) => {
              console.warn('[media-metadata] Failed to store upload metadata', {
                blobId: id,
                error
              })
            })
            .finally(() => {
              window.dispatchEvent(
                new CustomEvent('hhc:media-metadata-ready', { detail: { blobId: id } })
              )
            })
        }
        const shouldUseBrowserThumbnail = classification.kind !== 'video' || isWeb()
        if (shouldUseBrowserThumbnail && canGenerateThumbnail(classification.mimeType, file.name)) {
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
        await ensurePdfPageJob({ sourceBlobId: id, itemId: id, file })
      }

      if (id && classification.kind === 'video' && !isWeb()) {
        await enqueueVideoPosterJob({
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

export async function prepareUploadFilesForKind(
  files: File[],
  kind: Exclude<MediaKind, 'document'>
): Promise<UploadCandidate[]> {
  const candidates = await prepareUploadCandidates(files)
  return candidates.filter((candidate) => candidate.classification.kind === kind)
}

export async function uploadFilesForKind(
  files: File[],
  parentId: string,
  kind: Exclude<MediaKind, 'document'>
): Promise<number> {
  const candidates = await prepareUploadFilesForKind(files, kind)
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
