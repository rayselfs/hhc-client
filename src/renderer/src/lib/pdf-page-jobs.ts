import { getFileBlob, getFileSource, openFileExplorerDB } from './file-explorer-db'
import { MediaJobBlockedError, mediaJobQueue } from './media-job-queue'
import { getPdfPageThumbs, savePdfPageThumbBlobs } from './thumbnail-db'
import {
  BackgroundRenderingUnavailableError,
  renderPdfPageThumbnails
} from './thumbnail-worker-client'
import { getBlobId } from './blob-identity'

const pendingFiles = new Map<string, File>()

async function loadJobFile(sourceBlobId: string, itemId: string): Promise<File | null> {
  const db = await openFileExplorerDB()
  const requestedItem = await db.get('folder-items', itemId)
  const item =
    requestedItem?.type === 'file'
      ? requestedItem
      : (await db.getAll('folder-items')).find(
          (candidate) => candidate.type === 'file' && getBlobId(candidate) === sourceBlobId
        )
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
      pendingFiles.get(job.sourceBlobId) ?? (await loadJobFile(job.sourceBlobId, job.itemId))
    if (!file) throw new Error('PDF source is unavailable')
    const cachedThumbs = await getPdfPageThumbs(job.sourceBlobId)
    cachedThumbs.forEach((url) => URL.revokeObjectURL(url))
    if (cachedThumbs.length > 0) return
    let blobs: Blob[]
    try {
      blobs = await renderPdfPageThumbnails(file, signal)
    } catch (error) {
      if (error instanceof BackgroundRenderingUnavailableError) {
        throw new MediaJobBlockedError('configuration', error.message)
      }
      throw error
    }
    if (blobs.length > 0) await savePdfPageThumbBlobs(job.sourceBlobId, blobs)
  } finally {
    pendingFiles.delete(job.sourceBlobId)
  }
})

export async function ensurePdfPageJob(input: {
  sourceBlobId: string
  itemId: string
  file?: File
  priority?: number
}): Promise<void> {
  const cachedThumbs = await getPdfPageThumbs(input.sourceBlobId)
  cachedThumbs.forEach((url) => URL.revokeObjectURL(url))
  if (cachedThumbs.length > 0) return

  if (input.file) pendingFiles.set(input.sourceBlobId, input.file)
  try {
    await mediaJobQueue.enqueue({
      type: 'pdf-pages',
      sourceBlobId: input.sourceBlobId,
      itemId: input.itemId,
      dedupeKey: `pdf-pages:${input.sourceBlobId}`,
      ...(input.priority !== undefined ? { priority: input.priority } : {})
    })
  } catch (error) {
    pendingFiles.delete(input.sourceBlobId)
    throw error
  }
}
