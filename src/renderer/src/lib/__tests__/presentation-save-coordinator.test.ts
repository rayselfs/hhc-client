import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlankEditablePresentationDocument } from '../editable-presentation'
import {
  createPresentationSaveCoordinator,
  type PersistPresentationRevision,
  type PresentationSaveRequest
} from '../presentation-save-coordinator'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('presentation save coordinator', () => {
  const initialDocument = createBlankEditablePresentationDocument('Initial')

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for the trailing debounce before persisting', async () => {
    const persist = vi.fn<PersistPresentationRevision>().mockResolvedValue({
      revision: 1,
      mirrorWarnings: []
    })
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)

    coordinator.schedule({ ...initialDocument, name: 'Changed' })
    await vi.advanceTimersByTimeAsync(249)
    expect(persist).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await coordinator.flush()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(coordinator.getState().status).toBe('saved')
  })

  it('serializes writes and keeps only the newest pending revision', async () => {
    const firstWrite = deferred<{ revision: number; mirrorWarnings: [] }>()
    const persistedRequests: PresentationSaveRequest[] = []
    const persist: PersistPresentationRevision = vi.fn(async (request: PresentationSaveRequest) => {
      persistedRequests.push(request)
      if (request.revision === 1) return firstWrite.promise
      return { revision: request.revision, mirrorWarnings: [] }
    })
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)

    coordinator.schedule({ ...initialDocument, name: 'One' })
    await vi.advanceTimersByTimeAsync(250)
    coordinator.schedule({ ...initialDocument, name: 'Two' })
    coordinator.schedule({ ...initialDocument, name: 'Three' })

    expect(persistedRequests.map((request) => request.revision)).toEqual([1])
    firstWrite.resolve({ revision: 1, mirrorWarnings: [] })
    await coordinator.flush()

    expect(persistedRequests.map((request) => request.revision)).toEqual([1, 3])
    expect(persistedRequests[1].document.name).toBe('Three')
    expect(coordinator.getState()).toMatchObject({
      status: 'saved',
      scheduledRevision: 3,
      persistedRevision: 3
    })
  })

  it('flushes the newest revision without waiting for debounce', async () => {
    const persist = vi.fn<PersistPresentationRevision>().mockImplementation(async (request) => ({
      revision: request.revision,
      mirrorWarnings: []
    }))
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)

    coordinator.schedule({ ...initialDocument, name: 'Immediate' })
    await coordinator.flush()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(coordinator.getState().persistedRevision).toBe(1)
  })

  it('retains an error and retries the newest revision', async () => {
    const persist = vi
      .fn<PersistPresentationRevision>()
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockImplementationOnce(async (request) => ({
        revision: request.revision,
        mirrorWarnings: []
      }))
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)

    coordinator.schedule({ ...initialDocument, name: 'Retry me' })
    await expect(coordinator.flush()).rejects.toThrow('quota exceeded')
    expect(coordinator.getState()).toMatchObject({
      status: 'error',
      scheduledRevision: 1,
      persistedRevision: 0,
      error: 'quota exceeded'
    })

    coordinator.retry()
    await coordinator.flush()

    expect(persist).toHaveBeenCalledTimes(2)
    expect(coordinator.getState()).toMatchObject({
      status: 'saved',
      scheduledRevision: 1,
      persistedRevision: 1,
      error: null
    })
  })

  it('cancels a pending revision when discarded', async () => {
    const persist = vi.fn<PersistPresentationRevision>()
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)

    coordinator.schedule({ ...initialDocument, name: 'Pending' })
    await coordinator.discard()
    await vi.runAllTimersAsync()

    expect(persist).not.toHaveBeenCalled()
    expect(coordinator.getLastPersistedDocument()).toBe(initialDocument)
    expect(coordinator.getState()).toMatchObject({
      status: 'saved',
      scheduledRevision: 0,
      persistedRevision: 0
    })
  })

  it('waits for an in-flight revision before completing discard', async () => {
    const write = deferred<{ revision: number; mirrorWarnings: [] }>()
    const persist = vi.fn<PersistPresentationRevision>().mockReturnValue(write.promise)
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)
    const changed = { ...initialDocument, name: 'Already writing' }

    coordinator.schedule(changed)
    await vi.advanceTimersByTimeAsync(250)
    let discarded = false
    const discard = coordinator.discard().then(() => {
      discarded = true
    })
    await Promise.resolve()
    expect(discarded).toBe(false)

    write.resolve({ revision: 1, mirrorWarnings: [] })
    await discard

    expect(coordinator.getLastPersistedDocument()).toBe(changed)
    expect(coordinator.getState()).toMatchObject({
      status: 'saved',
      scheduledRevision: 1,
      persistedRevision: 1
    })
  })

  it('reports non-authoritative mirror warnings without failing the save', async () => {
    const persist = vi.fn<PersistPresentationRevision>().mockResolvedValue({
      revision: 1,
      mirrorWarnings: ['derived-document']
    })
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)

    coordinator.schedule({ ...initialDocument, name: 'Warned' })
    await coordinator.flush()

    expect(coordinator.getState()).toMatchObject({
      status: 'saved',
      mirrorWarnings: ['derived-document']
    })
  })

  it('disposes its timer and prevents stale completion notifications', async () => {
    const write = deferred<{ revision: number; mirrorWarnings: [] }>()
    const persist = vi.fn<PersistPresentationRevision>().mockReturnValue(write.promise)
    const coordinator = createPresentationSaveCoordinator(initialDocument, persist)
    const listener = vi.fn()
    coordinator.subscribe(listener)

    coordinator.schedule({ ...initialDocument, name: 'Writing' })
    await vi.advanceTimersByTimeAsync(250)
    expect(listener).toHaveBeenCalledTimes(2)

    coordinator.dispose()
    write.resolve({ revision: 1, mirrorWarnings: [] })
    await Promise.resolve()
    await Promise.resolve()

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
