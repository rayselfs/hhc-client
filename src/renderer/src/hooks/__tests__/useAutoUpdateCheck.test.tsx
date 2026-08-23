import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoUpdateCheck } from '../useAutoUpdateCheck'
import { useUpdateStore } from '@renderer/stores/update'

const mocks = vi.hoisted(() => ({
  statusHandler: null as ((data: { status: string; percent?: number }) => void) | null
}))

vi.mock('@renderer/lib/env', () => ({ isElectron: () => true }))

describe('useAutoUpdateCheck', () => {
  beforeEach(() => {
    mocks.statusHandler = null
    useUpdateStore.getState().reset()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        update: {
          onStatusChanged: vi.fn((handler) => {
            mocks.statusHandler = handler
            return vi.fn()
          })
        }
      }
    })
  })

  it('stores updater download percentage from IPC', () => {
    renderHook(() => useAutoUpdateCheck())

    act(() => mocks.statusHandler?.({ status: 'downloading', percent: 42 }))

    expect(useUpdateStore.getState()).toMatchObject({
      status: 'downloading',
      downloadPercent: 42
    })
  })
})
