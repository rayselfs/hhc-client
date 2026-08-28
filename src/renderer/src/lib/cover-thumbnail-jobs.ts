import { getFileBlob, getFileSource, openFileExplorerDB } from './file-explorer-db'
import { mediaJobQueue } from './media-job-queue'
import { generateThumbnail } from './thumbnail-generator'
import { saveThumbnail } from './thumbnail-db'

const pendingFiles = new Map<string, { file: File; mimeType: string }>()

async function loadJobFile(sourceBlobId: string, itemId: string): Promise<File | null> {
  const db = await openFileExplorerDB()
  const item = await db.get('folder-items', itemId)
  if (!item || item.type !== 'file') return null

  const blob = await getFileBlob(db, sourceBlobId)
  if (blob) return new File([blob], item.name, { type: item.mimeType })

  const source = await getFileSource(db, sourceBlobId, item.mimeType)
  if (!source) return null
  try {
    const response = await fetch(source.url)
    if (!response.ok) throw new Error(`Failed to read thumbnail source: ${response.status}`)
    return new File([await response.blob()], item.name, { type: item.mimeType })
  } finally {
    source.revoke()
  }
}

mediaJobQueue.registerExecutor('cover-thumbnail', async (job) => {
  if (!job.sourceBlobId || !job.itemId) throw new Error('Cover thumbnail job is missing source')
  try {
    const pending = pendingFiles.get(job.sourceBlobId)
    const file = pending?.file ?? (await loadJobFile(job.sourceBlobId, job.itemId))
    if (!file) throw new Error('Cover thumbnail source is unavailable')
    const dataUrl = await generateThumbnail(file, pending?.mimeType ?? file.type)
    if (dataUrl) await saveThumbnail(job.sourceBlobId, dataUrl)
    window.dispatchEvent(
      new CustomEvent('hhc:thumbnail-ready', { detail: { itemId: job.itemId, dataUrl } })
    )
  } finally {
    pendingFiles.delete(job.sourceBlobId)
  }
})

export async function enqueueCoverThumbnailJob(input: {
  sourceBlobId: string
  itemId: string
  file?: File
  mimeType: string
}): Promise<void> {
  if (input.file) {
    pendingFiles.set(input.sourceBlobId, { file: input.file, mimeType: input.mimeType })
  }
  try {
    await mediaJobQueue.enqueue({
      type: 'cover-thumbnail',
      sourceBlobId: input.sourceBlobId,
      itemId: input.itemId,
      dedupeKey: `cover-thumbnail:${input.sourceBlobId}`
    })
  } catch (error) {
    pendingFiles.delete(input.sourceBlobId)
    throw error
  }
}
