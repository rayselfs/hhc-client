import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deferMediaResourceCleanup,
  isMediaResourceLocked,
  lockMediaResources,
  resetMediaResourceLocksForTests
} from '../media-resource-locks'

describe('media resource locks', () => {
  beforeEach(() => {
    resetMediaResourceLocksForTests()
  })

  it('runs deferred cleanup only after the final lock is released', async () => {
    const firstRelease = lockMediaResources(['blob-1'])
    const secondRelease = lockMediaResources(['blob-1'])
    const cleanup = vi.fn()

    expect(deferMediaResourceCleanup('blob-1', cleanup)).toBe(true)
    firstRelease()
    await Promise.resolve()
    expect(cleanup).not.toHaveBeenCalled()

    secondRelease()
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce())
    expect(isMediaResourceLocked('blob-1')).toBe(false)
  })

  it('does not defer cleanup for an unlocked resource', () => {
    expect(deferMediaResourceCleanup('blob-1', vi.fn())).toBe(false)
  })
})
