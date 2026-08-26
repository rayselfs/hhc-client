import { isWeb } from './env'
import { MediaJobBlockedError, mediaJobQueue } from './media-job-queue'
import { findMediaJobByDedupeKey } from './media-work-db'
import { saveThumbnail } from './thumbnail-db'
import type { SyncDownloadCommitGuard } from './sync-provider'

const guards = new Map<string, SyncDownloadCommitGuard>()

async function assertPosterCommit(blobId: string): Promise<void> {
  const guard = guards.get(blobId)
  if ((await guard?.()) === false) throw new MediaJobBlockedError('authentication')
}

export async function enqueueVideoPosterJob(input: {
  sourceBlobId: string
  itemId: string
  priority?: number
  canCommit?: SyncDownloadCommitGuard
}): Promise<void> {
  if (isWeb()) return
  const { sourceBlobId: blobId, canCommit: guard } = input
  const dedupeKey = `video-poster:${blobId}`
  const existing = await findMediaJobByDedupeKey(dedupeKey)
  if (existing && !['failed', 'blocked', 'paused'].includes(existing.status)) return
  if ((await guard?.()) === false) return
  if (guard) guards.set(blobId, guard)
  if (existing) {
    await mediaJobQueue.retry(existing.id)
    return
  }

  await mediaJobQueue.enqueue({
    type: 'video-poster',
    sourceBlobId: blobId,
    itemId: input.itemId,
    priority: input.priority,
    dedupeKey
  })
}

mediaJobQueue.registerExecutor('video-poster', async (job) => {
  if (!job.sourceBlobId || !job.itemId) throw new Error('Video poster job is missing source')
  if (isWeb()) throw new MediaJobBlockedError('configuration', 'Video posters require Electron')
  const blobId = job.sourceBlobId
  try {
    await assertPosterCommit(blobId)
    const info = await window.api.videoPoster.getInfo()
    if (info.status !== 'ready') {
      throw new MediaJobBlockedError('configuration', info.status)
    }

    const result = await window.api.videoPoster.generate({ sourceFileId: blobId })
    await assertPosterCommit(blobId)
    await saveThumbnail(blobId, result.dataUrl)
    await assertPosterCommit(blobId)
    window.dispatchEvent(
      new CustomEvent('hhc:thumbnail-ready', {
        detail: { itemId: job.itemId, dataUrl: result.dataUrl }
      })
    )
  } finally {
    guards.delete(blobId)
  }
})
