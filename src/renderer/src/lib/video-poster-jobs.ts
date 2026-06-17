import { getBlobId } from './blob-identity'
import { isWeb } from './env'
import { openFileExplorerDB } from './file-explorer-db'
import { MediaJobBlockedError, mediaJobQueue } from './media-job-queue'
import { getDerivedAsset } from './media-work-db'
import { resolveMediaCapability } from './media-capabilities'
import { saveThumbnail } from './thumbnail-db'

function isTranscodeRequiredVideo(mimeType: string, name?: string): boolean {
  const capability = resolveMediaCapability({ mimeType, fileName: name })
  return capability?.kind === 'video' && capability.electron === 'transcode-required'
}

export async function enqueueVideoPosterJob(input: {
  sourceBlobId: string
  itemId: string
  priority?: number
}): Promise<void> {
  if (isWeb()) return

  await mediaJobQueue.enqueue({
    type: 'video-poster',
    sourceBlobId: input.sourceBlobId,
    itemId: input.itemId,
    priority: input.priority,
    dedupeKey: `video-poster:${input.sourceBlobId}`
  })
}

export async function backfillTranscodeVideoThumbnails(): Promise<void> {
  if (isWeb()) return
  const config = await window.api.videoTranscode.getFfmpegConfig()
  if (config.status !== 'ready') return

  const db = await openFileExplorerDB()
  const items = await db.getAll('folder-items')
  await Promise.all(
    items.map(async (item) => {
      if (item.type !== 'file' || !isTranscodeRequiredVideo(item.mimeType, item.name)) return
      const blobId = getBlobId(item)
      const existing = await getDerivedAsset(blobId, 'cover-thumbnail')
      if (existing?.status === 'ready') return
      await enqueueVideoPosterJob({ sourceBlobId: blobId, itemId: item.id })
    })
  )
}

mediaJobQueue.registerExecutor('video-poster', async (job) => {
  if (!job.sourceBlobId || !job.itemId) throw new Error('Video poster job is missing source')
  if (isWeb()) throw new MediaJobBlockedError('configuration', 'Video posters require Electron')

  const config = await window.api.videoTranscode.getFfmpegConfig()
  if (config.status !== 'ready') {
    throw new MediaJobBlockedError('configuration', config.status)
  }

  const result = await window.api.videoTranscode.generatePoster({ sourceFileId: job.sourceBlobId })
  await saveThumbnail(job.sourceBlobId, result.dataUrl)
  window.dispatchEvent(
    new CustomEvent('hhc:thumbnail-ready', {
      detail: { itemId: job.itemId, dataUrl: result.dataUrl }
    })
  )
})
