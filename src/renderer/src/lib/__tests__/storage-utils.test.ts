import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockToast = vi.hoisted(() => ({ warning: vi.fn() }))
vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual('@heroui/react')
  return { ...actual, toast: mockToast }
})

vi.mock('@renderer/i18n', () => ({
  default: { t: (key: string) => key }
}))

import { safeStorageSet } from '@renderer/lib/storage-utils'

beforeEach(() => {
  mockToast.warning.mockClear()
})

describe('safeStorageSet', () => {
  it('calls localStorage.setItem with key and value', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
    safeStorageSet('test-key', 'test-value')
    expect(spy).toHaveBeenCalledWith('test-key', 'test-value')
    spy.mockRestore()
  })

  it('shows toast.warning when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    safeStorageSet('test-key', 'test-value')
    expect(mockToast.warning).toHaveBeenCalledWith('toast.storageSaveFailed')
    spy.mockRestore()
  })

  it('does not show toast when localStorage succeeds', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
    safeStorageSet('test-key', 'test-value')
    expect(mockToast.warning).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
