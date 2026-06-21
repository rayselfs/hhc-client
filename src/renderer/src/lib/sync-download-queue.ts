import type {
  ReadOnlySyncProvider,
  SyncDownloadRequest,
  SyncDownloadResult,
  SyncRetryClassification
} from './sync-provider'
import { putSyncEntry, type SyncEntryRecord, type SyncEntryStatus } from './sync-db'
import { isSyncStorageLimitError } from './sync-download-storage'

export const SYNC_DOWNLOAD_CONCURRENCY = 1

const RETRY_BACKOFF_MS = [30_000, 60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000]

export type SyncDownloadPriority = 'presentation' | 'manual' | 'background'

export interface SyncDownloadEntry {
  providerConnectionId: string
  remoteItemId: string
  parentRemoteItemId: string | null
  kind: 'file'
  name: string
  itemId: string
  mimeType?: string
  size?: number
  etag?: string
  contentHash?: string
}

export interface SyncDownloadFailure {
  status: SyncEntryStatus
  errorKind?: SyncRetryClassification
  retryCount?: number
  nextRetryAt?: number
  lastError: string
}

export interface EnqueueSyncDownloadInput {
  provider: ReadOnlySyncProvider
  request: SyncDownloadRequest
  entry: SyncDownloadEntry
  previousEntry?: SyncEntryRecord
  priority?: SyncDownloadPriority
  onDownloaded?: (result: SyncDownloadResult) => void | Promise<void>
}

interface SyncDownloadQueueJob extends EnqueueSyncDownloadInput {
  key: string
  priorityValue: number
  sequence: number
  promise: Promise<SyncDownloadResult | null>
  resolve: (result: SyncDownloadResult | null) => void
}

const priorityValues: Record<SyncDownloadPriority, number> = {
  presentation: 0,
  manual: 1,
  background: 2
}

const queuedJobs: SyncDownloadQueueJob[] = []
const jobsByKey = new Map<string, SyncDownloadQueueJob>()
let activeCount = 0
let nextSequence = 0

function getQueueKey(request: SyncDownloadRequest): string {
  return `${request.providerConnectionId}:${request.remoteItemId}`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getRetryDelayMs(retryCount: number): number {
  return RETRY_BACKOFF_MS[Math.min(Math.max(retryCount - 1, 0), RETRY_BACKOFF_MS.length - 1)]
}

export function classifySyncDownloadFailure(
  provider: Pick<ReadOnlySyncProvider, 'classifyError'>,
  error: unknown,
  previousEntry: SyncEntryRecord | undefined,
  now = Date.now()
): SyncDownloadFailure {
  if (isSyncStorageLimitError(error)) {
    return {
      status: 'insufficient-storage',
      lastError: getErrorMessage(error)
    }
  }

  const errorKind = provider.classifyError(error)
  if (errorKind === 'retryable' || errorKind === 'offline') {
    const retryCount = (previousEntry?.retryCount ?? 0) + 1
    return {
      status: 'failed',
      errorKind,
      retryCount,
      nextRetryAt: now + getRetryDelayMs(retryCount),
      lastError: getErrorMessage(error)
    }
  }

  return {
    status: 'failed',
    errorKind,
    lastError: getErrorMessage(error)
  }
}

export function enqueueSyncDownload(
  input: EnqueueSyncDownloadInput
): Promise<SyncDownloadResult | null> {
  const key = getQueueKey(input.request)
  const priorityValue = priorityValues[input.priority ?? 'background']
  const existing = jobsByKey.get(key)
  if (existing) {
    existing.priorityValue = Math.min(existing.priorityValue, priorityValue)
    sortQueuedJobs()
    return existing.promise
  }

  let resolve!: (result: SyncDownloadResult | null) => void
  const promise = new Promise<SyncDownloadResult | null>((resolvePromise) => {
    resolve = resolvePromise
  })
  const job: SyncDownloadQueueJob = {
    ...input,
    key,
    priorityValue,
    sequence: nextSequence++,
    promise,
    resolve
  }
  queuedJobs.push(job)
  jobsByKey.set(key, job)
  sortQueuedJobs()
  pumpSyncDownloadQueue()
  return promise
}

function sortQueuedJobs(): void {
  queuedJobs.sort((a, b) => a.priorityValue - b.priorityValue || a.sequence - b.sequence)
}

function pumpSyncDownloadQueue(): void {
  while (activeCount < SYNC_DOWNLOAD_CONCURRENCY && queuedJobs.length > 0) {
    const job = queuedJobs.shift()
    if (!job) return
    activeCount += 1
    void runSyncDownloadJob(job)
  }
}

async function runSyncDownloadJob(job: SyncDownloadQueueJob): Promise<void> {
  try {
    await putSyncEntry({
      ...job.entry,
      status: 'downloading',
      errorKind: undefined,
      retryCount: undefined,
      nextRetryAt: undefined,
      lastError: undefined,
      downloadedBytes: 0,
      downloadTotalBytes: job.entry.size
    })
    const result = await job.provider.downloadContent(job.request, new AbortController().signal)
    await job.onDownloaded?.(result)
    job.resolve(result)
  } catch (error) {
    const failure = classifySyncDownloadFailure(job.provider, error, job.previousEntry)
    await putSyncEntry({
      ...job.entry,
      ...failure
    })
    console.warn('[sync] Failed to download synced file', {
      providerConnectionId: job.entry.providerConnectionId,
      remoteItemId: job.entry.remoteItemId,
      error
    })
    job.resolve(null)
  } finally {
    activeCount = Math.max(0, activeCount - 1)
    if (jobsByKey.get(job.key) === job) jobsByKey.delete(job.key)
    pumpSyncDownloadQueue()
  }
}

export function resetSyncDownloadQueueForTests(): void {
  queuedJobs.splice(0, queuedJobs.length)
  jobsByKey.clear()
  activeCount = 0
  nextSequence = 0
}
