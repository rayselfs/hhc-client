import { isWeb } from './env'
import { MediaJobBlockedError, mediaJobQueue } from './media-job-queue'
import { findMediaJobByDedupeKey } from './media-work-db'
import { saveThumbnail } from './thumbnail-db'

export async function enqueueVideoPosterJob(input: {
  sourceBlobId: string
  itemId: string
  priority?: number
}): Promise<void> {
  if (isWeb()) return
  const dedupeKey = `video-poster:${input.sourceBlobId}`
  const existing = await findMediaJobByDedupeKey(dedupeKey)
  if (existing && ['failed', 'blocked', 'paused'].includes(existing.status)) {
    await mediaJobQueue.retry(existing.id)
    return
  }

  await mediaJobQueue.enqueue({
    type: 'video-poster',
    sourceBlobId: input.sourceBlobId,
    itemId: input.itemId,
    priority: input.priority,
    dedupeKey
  })
}

mediaJobQueue.registerExecutor('video-poster', async (job) => {
  if (!job.sourceBlobId || !job.itemId) throw new Error('Video poster job is missing source')
  if (isWeb()) throw new MediaJobBlockedError('configuration', 'Video posters require Electron')

  const info = await window.api.videoPoster.getInfo()
  if (info.status !== 'ready') {
    throw new MediaJobBlockedError('configuration', info.status)
  }

  const result = await window.api.videoPoster.generate({ sourceFileId: job.sourceBlobId })
  await saveThumbnail(job.sourceBlobId, result.dataUrl)
  window.dispatchEvent(
    new CustomEvent('hhc:thumbnail-ready', {
      detail: { itemId: job.itemId, dataUrl: result.dataUrl }
    })
  )
})
