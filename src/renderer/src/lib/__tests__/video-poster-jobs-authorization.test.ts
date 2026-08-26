import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueVideoPosterJob } from '../video-poster-jobs'
import {
  getDerivedAsset,
  listMediaJobs,
  resetMediaWorkDBForTests,
  type MediaJobRecord
} from '../media-work-db'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('video poster authorization', () => {
  const getJob = async (): Promise<MediaJobRecord | undefined> => (await listMediaJobs())[0]

  beforeEach(async () => {
    await resetMediaWorkDBForTests()
  })

  it('does not persist a poster job when authorization is already revoked', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { videoPoster: { getInfo: vi.fn(), generate: vi.fn() } }
    })

    await enqueueVideoPosterJob({
      sourceBlobId: 'revoked-video',
      itemId: 'revoked-item',
      canCommit: async () => false
    })

    await expect(listMediaJobs()).resolves.toEqual([])
  })

  it('blocks a poster result and ready event when authorization changes during generation', async () => {
    const generated = deferred<{ dataUrl: string }>()
    const generate = vi.fn(() => generated.promise)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    let authorized = true
    const ready = vi.fn()
    window.addEventListener('hhc:thumbnail-ready', ready)

    await enqueueVideoPosterJob({
      sourceBlobId: 'guarded-video',
      itemId: 'guarded-item',
      canCommit: async () => authorized
    })
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce())
    authorized = false
    generated.resolve({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    await expect(getDerivedAsset('guarded-video', 'cover-thumbnail')).resolves.toBeUndefined()
    expect(ready).not.toHaveBeenCalled()
    window.removeEventListener('hhc:thumbnail-ready', ready)
  })
})
