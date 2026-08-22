import { describe, expect, it, vi } from 'vitest'

const { mockApp } = vi.hoisted(() => ({
  mockApp: {
    isPackaged: true,
    getAppPath: vi.fn(() => '/app')
  }
}))

vi.mock('electron', () => ({ app: mockApp }))

vi.mock('fs', () => ({
  accessSync: vi.fn(),
  constants: { F_OK: 0, X_OK: 1 },
  default: {
    accessSync: vi.fn(),
    constants: { F_OK: 0, X_OK: 1 }
  }
}))

vi.mock('electron-vlc-player', () => {
  throw new Error('Cannot find module vlc_binding.node')
})

describe('video engine runtime module', () => {
  it('can load without evaluating the VLC native module', async () => {
    await expect(import('../video-engine-runtime')).resolves.toMatchObject({
      resolveVlcRuntime: expect.any(Function)
    })
  })
})
