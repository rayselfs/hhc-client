import { addFileItemToStore, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { saveThumbnail } from '@renderer/lib/thumbnail-db'

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'pptx', 'ppt', 'key', 'odp'])

export function isSupportedFile(file: File): boolean {
  const { type, name } = file
  if (type.startsWith('image/') || type.startsWith('video/')) return true
  if (type === 'application/pdf' || type.startsWith('application/vnd.')) return true
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_EXTENSIONS.has(ext)
}

export function canGenerateThumbnail(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/pdf'
  )
}

export async function uploadFiles(files: File[], parentId: string): Promise<void> {
  const ids = await Promise.all(files.map((f) => addFileItemToStore(f, parentId)))
  files.forEach((file, i) => {
    const itemId = ids[i]
    if (canGenerateThumbnail(file.type)) {
      void generateThumbnail(file).then(async (dataUrl) => {
        if (dataUrl) await saveThumbnail(itemId, dataUrl)
        window.dispatchEvent(
          new CustomEvent('hhc:thumbnail-ready', { detail: { itemId, dataUrl } })
        )
      })
    }
  })
}

export async function uploadFolderFiles(
  allFiles: File[],
  currentFolderId: string,
  addFolder: (name: string, parentId: string, expiresAt?: number | null) => string
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
