import type { MediaJobRecord, MediaJobStatus } from './media-work-db'

export type MediaProcessingStatus = Exclude<MediaJobStatus, 'completed' | 'cancelled'>

export interface MediaJobViewState {
  status: MediaProcessingStatus
  progress?: number
}

const STATUS_RANK: Record<MediaProcessingStatus, number> = {
  queued: 1,
  running: 2,
  paused: 3,
  blocked: 4,
  failed: 5
}

export function buildMediaJobViewState(
  jobs: readonly MediaJobRecord[]
): Record<string, MediaJobViewState> {
  const result: Record<string, MediaJobViewState & { updatedAt: number }> = {}
  for (const job of jobs) {
    if (!job.itemId || job.status === 'completed' || job.status === 'cancelled') continue
    const current = result[job.itemId]
    if (
      !current ||
      STATUS_RANK[job.status] > STATUS_RANK[current.status] ||
      (STATUS_RANK[job.status] === STATUS_RANK[current.status] && job.updatedAt > current.updatedAt)
    ) {
      result[job.itemId] = { status: job.status, progress: job.progress, updatedAt: job.updatedAt }
    }
  }
  return Object.fromEntries(
    Object.entries(result).map(([itemId, { status, progress }]) => [itemId, { status, progress }])
  )
}
