import { describe, expect, it, vi } from 'vitest'
import { createPersistenceOperationQueue } from '@renderer/lib/persistence-operation-queue'

function deferred(): {
  promise: Promise<void>
  resolve: () => void
} {
  let resolve = (): void => undefined
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('createPersistenceOperationQueue', () => {
  it('runs operations serially in enqueue order', async () => {
    const first = deferred()
    const calls: string[] = []
    const queue = createPersistenceOperationQueue()

    queue.enqueue(async () => {
      calls.push('first:start')
      await first.promise
      calls.push('first:end')
    })
    queue.enqueue(async () => {
      calls.push('second')
    })

    await vi.waitFor(() => expect(calls).toEqual(['first:start']))
    expect(queue.snapshot()).toMatchObject({ pendingCount: 2, status: 'saving' })

    first.resolve()

    await vi.waitFor(() => {
      expect(calls).toEqual(['first:start', 'first:end', 'second'])
      expect(queue.snapshot()).toEqual({ pendingCount: 0, status: 'idle', error: null })
    })
  })

  it('retains a failed operation and blocks later writes until retry succeeds', async () => {
    let shouldFail = true
    const calls: string[] = []
    const queue = createPersistenceOperationQueue()

    queue.enqueue(async () => {
      calls.push('first')
      if (shouldFail) throw new Error('quota exceeded')
    })
    queue.enqueue(async () => {
      calls.push('second')
    })

    await vi.waitFor(() => expect(queue.snapshot().status).toBe('failed'))
    expect(calls).toEqual(['first'])
    expect(queue.snapshot()).toEqual({
      pendingCount: 2,
      status: 'failed',
      error: 'quota exceeded'
    })

    shouldFail = false
    await queue.retry()

    expect(calls).toEqual(['first', 'first', 'second'])
    expect(queue.snapshot()).toEqual({ pendingCount: 0, status: 'idle', error: null })
  })

  it('reports non-Error failures and notifies subscribers of state changes', async () => {
    const listener = vi.fn()
    const queue = createPersistenceOperationQueue()
    const unsubscribe = queue.subscribe(listener)

    queue.enqueue(async () => {
      throw 'storage unavailable'
    })

    await vi.waitFor(() => expect(queue.snapshot().status).toBe('failed'))
    expect(queue.snapshot()).toEqual({
      pendingCount: 1,
      status: 'failed',
      error: 'storage unavailable'
    })
    expect(listener).toHaveBeenCalledWith({
      pendingCount: 1,
      status: 'failed',
      error: 'storage unavailable'
    })

    unsubscribe()
    listener.mockClear()
    await queue.retry()
    expect(listener).not.toHaveBeenCalled()
  })
})
