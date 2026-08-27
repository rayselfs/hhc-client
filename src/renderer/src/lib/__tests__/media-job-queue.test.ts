import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaJobBlockedError, MediaJobQueue } from '../media-job-queue'
import {
  countFailedOrBlockedMediaJobs,
  getMediaJob,
  listMediaJobs,
  putMediaJob,
  resetMediaWorkDBForTests,
  type MediaJobRecord
} from '../media-work-db'

async function waitForJob(id: string, status: MediaJobRecord['status']): Promise<MediaJobRecord> {
  return vi.waitFor(
    async () => {
      const job = await getMediaJob(id)
      expect(job?.status).toBe(status)
      return job!
    },
    { timeout: 2000 }
  )
}

describe('MediaJobQueue', () => {
  beforeEach(async () => {
    await resetMediaWorkDBForTests()
  })

  it('deduplicates non-terminal work', async () => {
    const queue = new MediaJobQueue()

    const first = await queue.enqueue({ type: 'pdf-pages', dedupeKey: 'pdf:blob-1' })
    const second = await queue.enqueue({ type: 'pdf-pages', dedupeKey: 'pdf:blob-1' })

    expect(second.id).toBe(first.id)
    await expect(listMediaJobs()).resolves.toHaveLength(1)
  })

  it('deduplicates concurrent enqueue calls', async () => {
    const queue = new MediaJobQueue()

    const [first, second] = await Promise.all([
      queue.enqueue({ type: 'pdf-pages', dedupeKey: 'pdf:blob-1' }),
      queue.enqueue({ type: 'pdf-pages', dedupeKey: 'pdf:blob-1' })
    ])

    expect(second.id).toBe(first.id)
    await expect(listMediaJobs()).resolves.toHaveLength(1)
  })

  it('allows a new job after terminal history with the same dedupe key', async () => {
    const queue = new MediaJobQueue()
    const first = await queue.enqueue({ type: 'pdf-pages', dedupeKey: 'pdf:blob-1' })
    await queue.cancel(first.id)

    const second = await queue.enqueue({ type: 'pdf-pages', dedupeKey: 'pdf:blob-1' })

    expect(second.id).not.toBe(first.id)
  })

  it('respects bounded per-type concurrency', async () => {
    const queue = new MediaJobQueue({
      import: 1,
      'cover-thumbnail': 1,
      'pdf-pages': 1,
      'video-poster': 1,
      'sync-download': 1
    })
    let active = 0
    let maxActive = 0
    const releases: Array<() => void> = []
    queue.registerExecutor('cover-thumbnail', async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active--
    })

    const first = await queue.enqueue({ type: 'cover-thumbnail' })
    const second = await queue.enqueue({ type: 'cover-thumbnail' })
    await waitForJob(first.id, 'running')
    expect((await getMediaJob(second.id))?.status).toBe('queued')

    releases.shift()?.()
    await waitForJob(first.id, 'completed')
    await waitForJob(second.id, 'running')
    releases.shift()?.()
    await waitForJob(second.id, 'completed')
    expect(maxActive).toBe(1)
  })

  it('recovers stale running jobs after restart', async () => {
    const now = Date.now()
    await putMediaJob({
      id: 'stale-job',
      type: 'import',
      priority: 0,
      status: 'running',
      attempt: 1,
      createdAt: now - 10_000,
      updatedAt: now - 10_000
    })

    const queue = new MediaJobQueue()
    await expect(queue.recoverStaleJobs(now, 1000)).resolves.toBe(1)
    await expect(getMediaJob('stale-job')).resolves.toMatchObject({ status: 'queued' })
  })

  it('counts only failed or blocked jobs not explicitly excluded', async () => {
    const now = Date.now()
    await Promise.all(
      (['failed', 'blocked', 'running'] as const).map((status) =>
        putMediaJob({
          id: status,
          type: 'import',
          priority: 0,
          status,
          attempt: 1,
          createdAt: now,
          updatedAt: now
        })
      )
    )

    await expect(countFailedOrBlockedMediaJobs(['failed'])).resolves.toBe(1)
  })

  it('runs boosted pending jobs before lower-priority work', async () => {
    const queue = new MediaJobQueue({
      import: 1,
      'cover-thumbnail': 1,
      'pdf-pages': 1,
      'video-poster': 1,
      'sync-download': 1
    })
    const order: string[] = []
    let releaseFirst = (): void => undefined
    queue.registerExecutor('import', async (job) => {
      order.push(job.id)
      if (order.length === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
      }
    })

    const first = await queue.enqueue({ type: 'import' })
    await waitForJob(first.id, 'running')
    const low = await queue.enqueue({ type: 'import', priority: 0 })
    const boosted = await queue.enqueue({ type: 'import', priority: 0 })
    await queue.setPriority(boosted.id, 10)

    releaseFirst()
    await waitForJob(boosted.id, 'completed')
    await waitForJob(low.id, 'completed')
    expect(order).toEqual([first.id, boosted.id, low.id])
  })

  it('blocks resumable work without marking it failed and supports retry', async () => {
    const queue = new MediaJobQueue()
    const executor = vi
      .fn()
      .mockRejectedValueOnce(new MediaJobBlockedError('configuration'))
      .mockResolvedValueOnce(undefined)
    queue.registerExecutor('video-poster', executor)

    const job = await queue.enqueue({ type: 'video-poster' })
    await expect(waitForJob(job.id, 'blocked')).resolves.toMatchObject({
      blockedReason: 'configuration',
      attempt: 1
    })

    await queue.retry(job.id)
    await expect(waitForJob(job.id, 'completed')).resolves.toMatchObject({ attempt: 2 })
  })

  it('cancels active work and expires terminal history', async () => {
    const queue = new MediaJobQueue()
    queue.registerExecutor(
      'sync-download',
      (_, { signal }) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
    )

    const job = await queue.enqueue({ type: 'sync-download' })
    await waitForJob(job.id, 'running')
    await queue.cancel(job.id)
    await waitForJob(job.id, 'cancelled')

    await expect(queue.removeExpiredHistory(0)).resolves.toBe(1)
    await expect(getMediaJob(job.id)).resolves.toBeUndefined()
  })

  it('waits for cancelled active work to settle', async () => {
    const queue = new MediaJobQueue()
    let release = (): void => undefined
    queue.registerExecutor(
      'video-poster',
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )

    const job = await queue.enqueue({ type: 'video-poster', itemId: 'item-1' })
    await waitForJob(job.id, 'running')
    let settled = false
    const cancellation = queue.cancelAndWait(
      (candidate) => candidate.type === 'video-poster' && candidate.itemId === 'item-1'
    )
    void cancellation.then(() => {
      settled = true
    })

    await waitForJob(job.id, 'cancelled')
    expect(settled).toBe(false)
    release()
    await cancellation
    expect(settled).toBe(true)
  })

  it('keeps paused active work resumable after aborting its executor', async () => {
    const queue = new MediaJobQueue()
    queue.registerExecutor(
      'video-poster',
      (_, { signal }) =>
        new Promise<void>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
    )

    const job = await queue.enqueue({ type: 'video-poster' })
    await waitForJob(job.id, 'running')
    await queue.pause(job.id)

    await expect(waitForJob(job.id, 'paused')).resolves.toMatchObject({ attempt: 1 })
  })
})
