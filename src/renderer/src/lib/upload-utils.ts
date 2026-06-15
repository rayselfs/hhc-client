import { toast } from '@heroui/react/toast'
import { addFileItemToStore, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { generateThumbnail, generateAllPdfPageThumbnails } from '@renderer/lib/thumbnail-generator'
import { saveThumbnail, savePdfPageThumbs } from '@renderer/lib/thumbnail-db'
import { isWeb } from '@renderer/lib/env'
import { canGenerateMediaThumbnail, resolveMediaCapability } from '@renderer/lib/media-capabilities'

export const MAX_FILE_SIZE_WEB = 2 * 1024 * 1024 * 1024

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
  prefix: string = ''
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
    const nested = await Promise.all(children.map((c) => collectFromEntry(c, newPrefix)))
    return nested.flat()
  }
  return []
}

export function isSupportedFile(file: File): boolean {
  return resolveMediaCapability({ mimeType: file.type, fileName: file.name }) !== null
}

export function canGenerateThumbnail(mimeType: string): boolean {
  return canGenerateMediaThumbnail(resolveMediaCapability({ mimeType }))
}

export async function uploadFiles(files: File[], parentId: string): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      if (isWeb() && file.size > MAX_FILE_SIZE_WEB) {
        toast.danger(`File "${file.name}" exceeds 2GB limit`)
        return
      }
      const release = await uploadSemaphore.acquire()
      let id: string | undefined
      try {
        id = await addFileItemToStore(file, parentId)
        if (canGenerateThumbnail(file.type)) {
          const dataUrl = await generateThumbnail(file)
          if (dataUrl) {
            await saveThumbnail(id, dataUrl)
          }
          window.dispatchEvent(
            new CustomEvent('hhc:thumbnail-ready', { detail: { itemId: id, dataUrl } })
          )
        }
      } finally {
        release()
      }
      if (id && file.type === 'application/pdf') {
        const itemId = id
        void generateAllPdfPageThumbnails(file).then(async (dataUrls) => {
          if (dataUrls.length > 0) {
            await savePdfPageThumbs(itemId, dataUrls)
          }
        })
      }
    })
  )
}

export async function uploadFolderFiles(
  allFiles: File[],
  currentFolderId: string,
  addFolder: (name: string, parentId: string) => string
): Promise<void> {
  const filteredFiles = allFiles.filter(isSupportedFile)
  if (filteredFiles.length === 0) return

  const pathToFolderId = new Map<string, string>()

  for (const file of filteredFiles) {
    const parts = file.webkitRelativePath.split('/')
    for (let depth = 1; depth < parts.length; depth++) {
      const folderPath = parts.slice(0, depth).join('/')
      if (!pathToFolderId.has(folderPath)) {
        const parentPath = parts.slice(0, depth - 1).join('/')
        const parentId =
          depth === 1 ? currentFolderId : (pathToFolderId.get(parentPath) ?? currentFolderId)
        const id = addFolder(parts[depth - 1], parentId)
        pathToFolderId.set(folderPath, id)
      }
    }
  }

  const byParent = new Map<string, File[]>()
  for (const file of filteredFiles) {
    const parts = file.webkitRelativePath.split('/')
    const folderPath = parts.slice(0, parts.length - 1).join('/')
    const parentId = pathToFolderId.get(folderPath) ?? currentFolderId
    const group = byParent.get(parentId) ?? []
    group.push(file)
    byParent.set(parentId, group)
  }

  await Promise.all(
    Array.from(byParent.entries()).map(([parentId, files]) => uploadFiles(files, parentId))
  )
}

export async function uploadFolderFilesFromStore(
  allFiles: File[],
  currentFolderId: string
): Promise<void> {
  const addFolder = useFileExplorerStore.getState().addFolder
  await uploadFolderFiles(allFiles, currentFolderId, addFolder)
}

export async function uploadFromDataTransfer(
  items: DataTransferItemList,
  targetFolderId: string
): Promise<void> {
  const entries: FileSystemEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }

  const filesWithPaths = (await Promise.all(entries.map((e) => collectFromEntry(e)))).flat()
  const supported = filesWithPaths.filter((fp) => isSupportedFile(fp.file))
  if (supported.length === 0) return

  const { addFolder } = useFileExplorerStore.getState()
  const pathToFolderId = new Map<string, string>()

  for (const { relativePath } of supported) {
    const parts = relativePath.split('/')
    for (let depth = 1; depth < parts.length; depth++) {
      const folderPath = parts.slice(0, depth).join('/')
      if (!pathToFolderId.has(folderPath)) {
        const parentPath = parts.slice(0, depth - 1).join('/')
        const parentId =
          depth === 1 ? targetFolderId : (pathToFolderId.get(parentPath) ?? targetFolderId)
        const id = addFolder(parts[depth - 1], parentId)
        pathToFolderId.set(folderPath, id)
      }
    }
  }

  const byParent = new Map<string, File[]>()
  for (const { file, relativePath } of supported) {
    const parts = relativePath.split('/')
    const folderPath = parts.slice(0, parts.length - 1).join('/')
    const parentId = folderPath
      ? (pathToFolderId.get(folderPath) ?? targetFolderId)
      : targetFolderId
    const group = byParent.get(parentId) ?? []
    group.push(file)
    byParent.set(parentId, group)
  }

  await Promise.all(
    Array.from(byParent.entries()).map(([parentId, files]) => uploadFiles(files, parentId))
  )
}
