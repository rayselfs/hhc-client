import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettingsStore, TIMEZONE_OPTIONS } from '@renderer/stores/settings'

beforeEach(() => {
  useSettingsStore.setState({
    timezone: 'Asia/Taipei',
    hardwareAcceleration: true
  })
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

  it('persists to localStorage', () => {
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
    const stored = localStorage.getItem('hhc-settings')
    expect(stored).toBeDefined()
    const parsed = JSON.parse(stored!)
    expect(parsed.timezone).toBe('America/New_York')
    expect(parsed.hardwareAcceleration).toBe(true)

    vi.unstubAllGlobals()
  })
})

describe('setHardwareAcceleration', () => {
  it('updates store state', () => {
    useSettingsStore.getState().setHardwareAcceleration(false)
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false)
  })

  it('persists to localStorage', () => {
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
    const stored = localStorage.getItem('hhc-settings')
    expect(stored).toBeDefined()
    const parsed = JSON.parse(stored!)
    expect(parsed.hardwareAcceleration).toBe(false)
    expect(parsed.timezone).toBe('Asia/Taipei')

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

  it('resets localStorage to default state', () => {
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

    useSettingsStore.getState().setTimezone('Europe/Paris')
    useSettingsStore.getState().setHardwareAcceleration(false)
    useSettingsStore.getState().resetToDefaults()

    const stored = localStorage.getItem('hhc-settings')
    expect(stored).toBeDefined()
    const parsed = JSON.parse(stored!)
    expect(parsed.timezone).toBe('Asia/Taipei')
    expect(parsed.hardwareAcceleration).toBe(true)

    vi.unstubAllGlobals()
  })
})

describe('localStorage error handling', () => {
  it('initializes with defaults when localStorage has invalid JSON', () => {
    let localStorageMock: Record<string, string> = { 'hhc-settings': 'invalid-json{{{' }
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

    const s = useSettingsStore.getState()
    expect(s.timezone).toBe('Asia/Taipei')
    expect(s.hardwareAcceleration).toBe(true)

    vi.unstubAllGlobals()
  })

  it('uses defaults when stored data is missing required fields', () => {
    let localStorageMock: Record<string, string> = {
      'hhc-settings': JSON.stringify({ timezone: 'UTC' })
    }
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

    const s = useSettingsStore.getState()
    expect(s.timezone).toBe('Asia/Taipei')
    expect(s.hardwareAcceleration).toBe(true)

    vi.unstubAllGlobals()
  })
})

describe('persistence round-trip', () => {
  it('restores settings from localStorage on subsequent access', () => {
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

    const stored = localStorage.getItem('hhc-settings')
    expect(stored).toBeDefined()
    const parsed = JSON.parse(stored!)
    expect(parsed.timezone).toBe('Europe/London')
    expect(parsed.hardwareAcceleration).toBe(false)

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
