import { describe, expect, it, vi } from 'vitest'
import { createVlcPlayerRuntimeLoader, type VlcPlayerRuntime } from '../vlc-player-runtime'

describe('VLC player runtime loader', () => {
  it('does not load the native module until requested and caches a successful result', async () => {
    const runtime = {
      probeDefaultVlcDir: vi.fn(() => null)
    } as unknown as VlcPlayerRuntime
    const importRuntime = vi.fn(async () => runtime)
    const loadRuntime = createVlcPlayerRuntimeLoader(importRuntime)

    expect(importRuntime).not.toHaveBeenCalled()

    await expect(loadRuntime()).resolves.toEqual({ status: 'ready', runtime })
    await expect(loadRuntime()).resolves.toEqual({ status: 'ready', runtime })
    expect(importRuntime).toHaveBeenCalledTimes(1)
  })

  it('converts a missing native binding into a stable capability error', async () => {
    const loadRuntime = createVlcPlayerRuntimeLoader(async () => {
      throw new Error('Cannot find module vlc_binding.node')
    })

    await expect(loadRuntime()).resolves.toEqual({
      status: 'error',
      message: 'VLC native binding unavailable: Cannot find module vlc_binding.node'
    })
  })
})
