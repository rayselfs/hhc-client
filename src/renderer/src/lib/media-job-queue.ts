import {
  deleteMediaJob,
  findMediaJobByDedupeKey,
  getMediaJob,
  listMediaJobs,
  putMediaJob,
  type MediaJobBlockedReason,
  type MediaJobRecord,
  type MediaJobType
} from './media-work-db'

export interface MediaJobExecutionContext {
  signal: AbortSignal
  reportProgress: (progress: number) => Promise<void>
}

export type MediaJobExecutor = (
  job: MediaJobRecord,
  context: MediaJobExecutionContext
) => Promise<void>

export class MediaJobBlockedError extends Error {
  constructor(
    readonly reason: MediaJobBlockedReason,
    message = `Media job blocked: ${reason}`
  ) {
    super(message)
  }
}

const DEFAULT_CONCURRENCY: Record<MediaJobType, number> = {
  import: 3,
  'cover-thumbnail': 3,
  'pdf-pages': 1,
  transcode: 1,
  'sync-download': 2
}

const TERMINAL_STATUSES = new Set<MediaJobRecord['status']>(['completed', 'cancelled'])
export const MEDIA_JOB_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

interface ActiveJob {
  controller: AbortController
  type: MediaJobType
}

export class MediaJobQueue {
  private readonly executors = new Map<MediaJobType, MediaJobExecutor>()
  private readonly active = new Map<string, ActiveJob>()
  private readonly pendingEnqueues = new Map<string, Promise<MediaJobRecord>>()
  private pumping = false

  constructor(private readonly concurrency = DEFAULT_CONCURRENCY) {}

  registerExecutor(type: MediaJobType, executor: MediaJobExecutor): () => void {
    this.executors.set(type, executor)
    void this.pump()
    return () => {
      if (this.executors.get(type) === executor) this.executors.delete(type)
    }
  }

  async recoverStaleJobs(now = Date.now(), staleAfterMs = 5 * 60 * 1000): Promise<number> {
    const jobs = await listMediaJobs()
    let recovered = 0
    for (const job of jobs) {
      if (job.status !== 'running' || now - job.updatedAt < staleAfterMs) continue
      await putMediaJob({ ...job, status: 'queued', updatedAt: now })
      recovered++
    }
    if (recovered > 0) void this.pump()
    return recovered
  }

  enqueue(input: {
    type: MediaJobType
    sourceBlobId?: string
    itemId?: string
    dedupeKey?: string
    priority?: number
  }): Promise<MediaJobRecord> {
    if (!input.dedupeKey) return this.enqueueInternal(input)

    const pending = this.pendingEnqueues.get(input.dedupeKey)
    if (pending) return pending

    const operation = this.enqueueInternal(input).finally(() => {
      if (this.pendingEnqueues.get(input.dedupeKey!) === operation) {
        this.pendingEnqueues.delete(input.dedupeKey!)
      }
    })
    this.pendingEnqueues.set(input.dedupeKey, operation)
    return operation
  }

  private async enqueueInternal(input: {
    type: MediaJobType
    sourceBlobId?: string
    itemId?: string
    dedupeKey?: string
    priority?: number
  }): Promise<MediaJobRecord> {
    if (input.dedupeKey) {
      const existing = await findMediaJobByDedupeKey(input.dedupeKey)
      if (existing && !TERMINAL_STATUSES.has(existing.status)) {
        return existing
      }
    }

    const now = Date.now()
    const job: MediaJobRecord = {
      id: crypto.randomUUID(),
      type: input.type,
      sourceBlobId: input.sourceBlobId,
      itemId: input.itemId,
      dedupeKey: input.dedupeKey,
      priority: input.priority ?? 0,
      status: 'queued',
      progress: 0,
      attempt: 0,
      createdAt: now,
      updatedAt: now
    }
    await putMediaJob(job)
    void this.pump()
    return job
  }

  async setPriority(id: string, priority: number): Promise<void> {
    const job = await getMediaJob(id)
    if (!job || job.status !== 'queued') return
    await putMediaJob({ ...job, priority, updatedAt: Date.now() })
    void this.pump()
  }

  async retry(id: string): Promise<void> {
    const job = await getMediaJob(id)
    if (!job || !['failed', 'blocked', 'paused'].includes(job.status)) return
    await putMediaJob({
      ...job,
      status: 'queued',
      blockedReason: undefined,
      errorCode: undefined,
      progress: 0,
      updatedAt: Date.now()
    })
    void this.pump()
  }

  async pause(id: string): Promise<void> {
    const job = await getMediaJob(id)
    if (!job || job.status === 'paused' || TERMINAL_STATUSES.has(job.status)) return
    await putMediaJob({ ...job, status: 'paused', updatedAt: Date.now() })
    this.active.get(id)?.controller.abort()
  }

  async cancel(id: string): Promise<void> {
    const job = await getMediaJob(id)
    if (!job || TERMINAL_STATUSES.has(job.status)) return
    await putMediaJob({ ...job, status: 'cancelled', updatedAt: Date.now() })
    this.active.get(id)?.controller.abort()
  }

  async removeExpiredHistory(
    retentionMs = MEDIA_JOB_HISTORY_RETENTION_MS,
    now = Date.now()
  ): Promise<number> {
    const jobs = await listMediaJobs()
    const expired = jobs.filter(
      (job) => TERMINAL_STATUSES.has(job.status) && now - job.updatedAt >= retentionMs
    )
    await Promise.all(expired.map((job) => deleteMediaJob(job.id)))
    return expired.length
  }

  private async pump(): Promise<void> {
    if (this.pumping) return
    this.pumping = true
    try {
      const jobs = (await listMediaJobs())
        .filter((job) => job.status === 'queued' && this.executors.has(job.type))
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)

      for (const job of jobs) {
        const activeForType = [...this.active.values()].filter(
          (active) => active.type === job.type
        ).length
        if (activeForType >= this.concurrency[job.type]) continue
        if (this.active.has(job.id)) continue
        void this.run(job)
      }
    } finally {
      this.pumping = false
    }
  }

  private async run(job: MediaJobRecord): Promise<void> {
    const executor = this.executors.get(job.type)
    if (!executor) return

    const controller = new AbortController()
    this.active.set(job.id, { controller, type: job.type })
    const running: MediaJobRecord = {
      ...job,
      status: 'running',
      attempt: job.attempt + 1,
      updatedAt: Date.now()
    }
    await putMediaJob(running)

    try {
      await executor(running, {
        signal: controller.signal,
        reportProgress: async (progress) => {
          const current = await getMediaJob(job.id)
          if (!current || current.status !== 'running') return
          await putMediaJob({
            ...current,
            progress: Math.max(0, Math.min(100, progress)),
            updatedAt: Date.now()
          })
        }
      })
      const current = await getMediaJob(job.id)
      if (current?.status === 'running') {
        await putMediaJob({ ...current, status: 'completed', progress: 100, updatedAt: Date.now() })
      }
    } catch (error) {
      const current = await getMediaJob(job.id)
      if (!current || current.status === 'cancelled' || current.status === 'paused') return
      if (error instanceof MediaJobBlockedError) {
        await putMediaJob({
          ...current,
          status: 'blocked',
          blockedReason: error.reason,
          updatedAt: Date.now()
        })
      } else if (controller.signal.aborted) {
        await putMediaJob({ ...current, status: 'cancelled', updatedAt: Date.now() })
      } else {
        await putMediaJob({
          ...current,
          status: 'failed',
          errorCode: error instanceof Error ? error.message : 'unknown',
          updatedAt: Date.now()
        })
      }
    } finally {
      this.active.delete(job.id)
      void this.pump()
    }
  }
}

export const mediaJobQueue = new MediaJobQueue()
