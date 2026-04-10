import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockToast = vi.hoisted(() => ({ warning: vi.fn(), danger: vi.fn(), success: vi.fn() }))
vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual('@heroui/react')
  return { ...actual, toast: mockToast }
})

vi.mock('@renderer/i18n', () => ({
  default: { t: (key: string) => key }
}))

import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'

beforeEach(() => {
  useSettingsStore.setState({
    timezone: 'Asia/Taipei',
    hardwareAcceleration: true
  })
  mockToast.warning.mockClear()
  mockToast.success.mockClear()
})

describe('initial state', () => {
  it('starts with correct default values', () => {
    const s = useSettingsStore.getState()
    expect(s.timezone).toBe('Asia/Taipei')
    expect(s.hardwareAcceleration).toBe(true)
  })
})

describe('setTimezone', () => {
  it('updates store state', () => {
    useSettingsStore.getState().setTimezone('UTC')
    expect(useSettingsStore.getState().timezone).toBe('UTC')
  })

  it('persists to localStorage as plain string', () => {
    let localStorageMock: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value
      },
      removeItem: (key: string) => {
        delete localStorageMock[key]
      },
      clear: () => {
        localStorageMock = {}
      },
      length: 0,
      key: (index: number) => {
        const keys = Object.keys(localStorageMock)
        return keys[index] || null
      }
    })

    useSettingsStore.getState().setTimezone('America/New_York')
    expect(localStorage.getItem('hhc-timezone')).toBe('America/New_York')

    vi.unstubAllGlobals()
  })
})

describe('setHardwareAcceleration', () => {
  it('updates store state', () => {
    useSettingsStore.getState().setHardwareAcceleration(false)
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false)
  })

  it('persists to localStorage as string boolean', () => {
    let localStorageMock: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value
      },
      removeItem: (key: string) => {
        delete localStorageMock[key]
      },
      clear: () => {
        localStorageMock = {}
      },
      length: 0,
      key: (index: number) => {
        const keys = Object.keys(localStorageMock)
        return keys[index] || null
      }
    })

    useSettingsStore.getState().setHardwareAcceleration(false)
    expect(localStorage.getItem('hhc-hardwareAcceleration')).toBe('false')

    vi.unstubAllGlobals()
  })
})

describe('resetToDefaults', () => {
  it('reverts state to defaults after changes', () => {
    useSettingsStore.getState().setTimezone('UTC')
    useSettingsStore.getState().setHardwareAcceleration(false)
    expect(useSettingsStore.getState().timezone).toBe('UTC')
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false)

    useSettingsStore.getState().resetToDefaults()
    const s = useSettingsStore.getState()
    expect(s.timezone).toBe('Asia/Taipei')
    expect(s.hardwareAcceleration).toBe(true)
  })

  it('clears all localStorage and IndexedDB on reset', () => {
    let localStorageMock: Record<string, string> = {}
    const clearFn = vi.fn(() => {
      localStorageMock = {}
    })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value
      },
      removeItem: (key: string) => {
        delete localStorageMock[key]
      },
      clear: clearFn,
      length: 0,
      key: (index: number) => {
        const keys = Object.keys(localStorageMock)
        return keys[index] || null
      }
    })

    const deleteDatabase = vi.fn()
    vi.stubGlobal('indexedDB', {
      databases: vi.fn().mockResolvedValue([{ name: 'db1' }, { name: 'db2' }]),
      deleteDatabase
    })

    useSettingsStore.getState().setTimezone('Europe/Paris')
    useSettingsStore.getState().setHardwareAcceleration(false)
    expect(localStorage.getItem('hhc-timezone')).toBe('Europe/Paris')
    expect(localStorage.getItem('hhc-hardwareAcceleration')).toBe('false')

    useSettingsStore.getState().resetToDefaults()
    expect(clearFn).toHaveBeenCalled()
    expect(localStorage.getItem('hhc-timezone')).toBeNull()
    expect(localStorage.getItem('hhc-hardwareAcceleration')).toBeNull()

    vi.unstubAllGlobals()
  })
})

describe('persistence round-trip', () => {
  it('stores and retrieves individual keys', () => {
    let localStorageMock: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value
      },
      removeItem: (key: string) => {
        delete localStorageMock[key]
      },
      clear: () => {
        localStorageMock = {}
      },
      length: 0,
      key: (index: number) => {
        const keys = Object.keys(localStorageMock)
        return keys[index] || null
      }
    })

    useSettingsStore.getState().setTimezone('Europe/London')
    useSettingsStore.getState().setHardwareAcceleration(false)

    expect(localStorage.getItem('hhc-timezone')).toBe('Europe/London')
    expect(localStorage.getItem('hhc-hardwareAcceleration')).toBe('false')

    vi.unstubAllGlobals()
  })
})

describe('TIMEZONE_OPTIONS', () => {
  it('exports array with 9 timezone entries', () => {
    expect(TIMEZONE_OPTIONS).toHaveLength(9)
  })

  it('each entry has value and labelKey properties', () => {
    TIMEZONE_OPTIONS.forEach((option) => {
      expect(option).toHaveProperty('value')
      expect(option).toHaveProperty('labelKey')
      expect(typeof option.value).toBe('string')
      expect(typeof option.labelKey).toBe('string')
    })
  })

  it('includes expected timezone values', () => {
    const values = TIMEZONE_OPTIONS.map((opt) => opt.value)
    expect(values).toContain('Asia/Taipei')
    expect(values).toContain('Asia/Hong_Kong')
    expect(values).toContain('Asia/Singapore')
    expect(values).toContain('Asia/Tokyo')
    expect(values).toContain('Asia/Seoul')
    expect(values).toContain('America/New_York')
    expect(values).toContain('Europe/London')
    expect(values).toContain('Europe/Paris')
    expect(values).toContain('UTC')
  })
})

describe('resetToDefaults toast', () => {
  it('shows toast.success on settings reset', () => {
    useSettingsStore.getState().resetToDefaults()
    expect(mockToast.success).toHaveBeenCalledWith('toast.settingsReset')
  })
})

describe('storage toast notifications', () => {
  it('shows toast.warning when setTimezone storage fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    useSettingsStore.getState().setTimezone('UTC')
    expect(mockToast.warning).toHaveBeenCalledWith('toast.storageSaveFailed')
    spy.mockRestore()
  })

  it('shows toast.warning when setHardwareAcceleration storage fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    useSettingsStore.getState().setHardwareAcceleration(false)
    expect(mockToast.warning).toHaveBeenCalledWith('toast.storageSaveFailed')
    spy.mockRestore()
  })
})
