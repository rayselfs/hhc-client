import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const mockToast = vi.hoisted(() => ({ warning: vi.fn(), danger: vi.fn(), success: vi.fn() }))
vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual('@heroui/react')
  return { ...actual, toast: mockToast }
})
vi.mock('@heroui/react/toast', () => ({ toast: mockToast }))

vi.mock('@renderer/i18n', () => ({
  default: { t: (key: string) => key }
}))

vi.mock('@renderer/lib/site-data', () => ({
  clearAllSiteData: vi.fn()
}))

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn(() => false)
}))

import {
  useSettingsStore,
  TIMEZONE_OPTIONS,
  AZURE_REGION_OPTIONS,
  DEFAULT_SPEECH,
  DEFAULT_ONEDRIVE,
  getEffectiveOneDriveClientId,
  getDefaultSpeechSettings,
  LIBREPRESENTER_DEFAULT_ONEDRIVE_CLIENT_ID,
  normalizeSettingsState,
  validateOneDriveClientId
} from '@renderer/stores/settings'
import { clearAllSiteData } from '@renderer/lib/site-data'
import { isElectron } from '@renderer/lib/env'

const mockReload = vi.fn()

beforeEach(() => {
  useSettingsStore.setState({
    timezone: 'Asia/Taipei',
    hardwareAcceleration: true,
    themePreference: 'system',
    timerRingColor: '#3b82f6',
    speech: DEFAULT_SPEECH,
    oneDrive: DEFAULT_ONEDRIVE,
    projectionDisplayId: ''
  })
  mockToast.warning.mockClear()
  mockToast.success.mockClear()
  vi.mocked(clearAllSiteData).mockClear()
  mockReload.mockClear()
  Object.defineProperty(window, 'location', {
    value: { reload: mockReload },
    writable: true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initial state', () => {
  it('starts with correct default values', () => {
    const s = useSettingsStore.getState()
    expect(s.timezone).toBe('Asia/Taipei')
    expect(s.hardwareAcceleration).toBe(true)
    expect(s.themePreference).toBe('system')
  })
})

describe('setTimezone', () => {
  it('updates store state', () => {
    useSettingsStore.getState().setTimezone('UTC')
    expect(useSettingsStore.getState().timezone).toBe('UTC')
  })

  it('persists to localStorage with persist middleware format', () => {
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
    const persisted = localStorage.getItem('hhc-settings')
    expect(persisted).toBeTruthy()
    const parsed = JSON.parse(persisted!)
    expect(parsed.state.timezone).toBe('America/New_York')
    expect(parsed.version).toBe(11)

    vi.unstubAllGlobals()
  })
})

describe('setHardwareAcceleration', () => {
  it('updates store state', () => {
    useSettingsStore.getState().setHardwareAcceleration(false)
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(false)
  })

  it('persists to localStorage with persist middleware format', () => {
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
    const persisted = localStorage.getItem('hhc-settings')
    expect(persisted).toBeTruthy()
    const parsed = JSON.parse(persisted!)
    expect(parsed.state.hardwareAcceleration).toBe(false)
    expect(parsed.version).toBe(11)

    vi.unstubAllGlobals()
  })
})

describe('resetSettings', () => {
  it('restores settings without clearing user data', () => {
    useSettingsStore.getState().setHardwareAcceleration(false)
    useSettingsStore.getState().resetSettings()
    expect(useSettingsStore.getState().hardwareAcceleration).toBe(true)
    expect(clearAllSiteData).not.toHaveBeenCalled()
  })

  it('shows success toast', () => {
    useSettingsStore.getState().resetSettings()
    expect(mockToast.success).toHaveBeenCalledWith('toast.settingsReset')
  })
})

describe('resetToDefaults', () => {
  it('calls clearAllSiteData', () => {
    useSettingsStore.getState().resetToDefaults()
    expect(clearAllSiteData).toHaveBeenCalledOnce()
  })

  it('shows success toast', () => {
    useSettingsStore.getState().resetToDefaults()
    expect(mockToast.success).toHaveBeenCalledWith('toast.settingsReset')
  })

  it('reloads page after delay (web mode)', () => {
    vi.useFakeTimers()
    vi.mocked(isElectron).mockReturnValue(false)
    useSettingsStore.getState().resetToDefaults()
    expect(mockReload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(mockReload).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('calls app.relaunch after delay (electron mode)', () => {
    vi.useFakeTimers()
    vi.mocked(isElectron).mockReturnValue(true)
    const mockRelaunch = vi.fn()
    Object.defineProperty(window, 'api', {
      value: { app: { relaunch: mockRelaunch } },
      writable: true
    })
    useSettingsStore.getState().resetToDefaults()
    expect(mockRelaunch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(mockRelaunch).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })
})

describe('persistence round-trip', () => {
  it('stores and retrieves state in persist middleware format', () => {
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

    const persisted = localStorage.getItem('hhc-settings')
    expect(persisted).toBeTruthy()
    const parsed = JSON.parse(persisted!)
    expect(parsed.state.timezone).toBe('Europe/London')
    expect(parsed.state.hardwareAcceleration).toBe(false)
    expect(parsed.version).toBe(11)

    vi.unstubAllGlobals()
  })
})

describe('TIMEZONE_OPTIONS', () => {
  it('exports array with 8 timezone entries', () => {
    expect(TIMEZONE_OPTIONS).toHaveLength(8)
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
    expect(values).toContain('Asia/Tokyo')
    expect(values).toContain('America/New_York')
    expect(values).toContain('America/Los_Angeles')
    expect(values).toContain('Asia/Kuala_Lumpur')
    expect(values).toContain('Europe/Athens')
    expect(values).toContain('Australia/Melbourne')
    expect(values).toContain('Europe/London')
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

describe('themePreference', () => {
  it('defaults to system', () => {
    expect(useSettingsStore.getState().themePreference).toBe('system')
  })

  it('setThemePreference updates state', () => {
    useSettingsStore.getState().setThemePreference('dark')
    expect(useSettingsStore.getState().themePreference).toBe('dark')

    useSettingsStore.getState().setThemePreference('light')
    expect(useSettingsStore.getState().themePreference).toBe('light')
  })

  it('resetToDefaults calls clearAllSiteData and reloads', () => {
    vi.useFakeTimers()
    vi.mocked(isElectron).mockReturnValue(false)
    useSettingsStore.getState().setThemePreference('dark')
    useSettingsStore.getState().resetToDefaults()
    expect(clearAllSiteData).toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(mockReload).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('themePreference is included in persisted state', () => {
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

    useSettingsStore.getState().setThemePreference('dark')
    const persisted = localStorage.getItem('hhc-settings')
    expect(persisted).toBeTruthy()
    const parsed = JSON.parse(persisted!)
    expect(parsed.state.themePreference).toBe('dark')
    expect(parsed.version).toBe(11)

    vi.unstubAllGlobals()
  })
})

describe('speech settings', () => {
  it('defaults to Web Speech API on web', () => {
    vi.mocked(isElectron).mockReturnValue(false)
    expect(getDefaultSpeechSettings().activeProvider).toBe('webSpeech')
  })

  it('defaults to Azure Speech on Electron', () => {
    vi.mocked(isElectron).mockReturnValue(true)
    expect(getDefaultSpeechSettings().activeProvider).toBe('azure')
  })

  it('initializes with default speech settings', () => {
    const state = useSettingsStore.getState()
    expect(state.speech).toEqual(DEFAULT_SPEECH)
    expect(state.speech.activeProvider).toBe('azure')
    expect(state.speech.azure.region).toBe('eastasia')
  })

  it('updates speech settings', () => {
    const { setSpeech } = useSettingsStore.getState()
    const updated = { ...DEFAULT_SPEECH, azure: { ...DEFAULT_SPEECH.azure, region: 'westus2' } }

    setSpeech(updated)

    const state = useSettingsStore.getState()
    expect(state.speech.azure.region).toBe('westus2')
  })

  it('persists speech to localStorage with correct version', () => {
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

    const updated = { ...DEFAULT_SPEECH, azure: { ...DEFAULT_SPEECH.azure, region: 'japaneast' } }
    useSettingsStore.getState().setSpeech(updated)
    const persisted = localStorage.getItem('hhc-settings')
    expect(persisted).toBeTruthy()
    const parsed = JSON.parse(persisted!)
    expect(parsed.state.speech.azure.region).toBe('japaneast')
    expect(parsed.version).toBe(11)

    vi.unstubAllGlobals()
  })
})

describe('OneDrive settings', () => {
  it('uses the LibrePresenter default Client ID when custom override is empty', () => {
    expect(getEffectiveOneDriveClientId(DEFAULT_ONEDRIVE)).toBe(
      LIBREPRESENTER_DEFAULT_ONEDRIVE_CLIENT_ID
    )
  })

  it('validates Azure Application Client ID format', () => {
    expect(validateOneDriveClientId('4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02')).toBe(true)
    expect(validateOneDriveClientId('../not-a-client-id')).toBe(false)
  })

  it('persists non-sensitive OneDrive preferences only', () => {
    useSettingsStore.getState().setOneDrive({
      customClientId: '11111111-2222-3333-4444-555555555555',
      defaultOfflinePolicy: 'always-offline'
    })

    const state = useSettingsStore.getState()
    expect(state.oneDrive).toMatchObject({
      customClientId: '11111111-2222-3333-4444-555555555555',
      defaultOfflinePolicy: 'always-offline'
    })
    expect(state.oneDrive).not.toHaveProperty('accessToken')
    expect(state.oneDrive).not.toHaveProperty('refreshToken')
  })

  it('rejects invalid custom Client ID updates', () => {
    const before = useSettingsStore.getState().oneDrive
    useSettingsStore.getState().setOneDrive({
      customClientId: '../bad',
      defaultOfflinePolicy: 'online-only'
    })

    expect(useSettingsStore.getState().oneDrive).toEqual(before)
  })

  it('normalizes invalid persisted OneDrive preferences', () => {
    const normalized = normalizeSettingsState({
      oneDrive: {
        customClientId: '../bad',
        defaultOfflinePolicy: 'upload-everything'
      }
    })

    expect(normalized.oneDrive).toEqual(DEFAULT_ONEDRIVE)
  })

  it('normalizes valid persisted OneDrive preferences', () => {
    const normalized = normalizeSettingsState({
      oneDrive: {
        customClientId: '11111111-2222-3333-4444-555555555555',
        defaultOfflinePolicy: 'always-offline'
      }
    })

    expect(normalized.oneDrive).toEqual({
      customClientId: '11111111-2222-3333-4444-555555555555',
      defaultOfflinePolicy: 'always-offline'
    })
  })
})

describe('settings normalization', () => {
  it('restores documented defaults for invalid persisted values', () => {
    const normalized = normalizeSettingsState({
      timezone: 'Mars/Base',
      hardwareAcceleration: 'yes',
      themePreference: 'sepia',
      timerRingColor: 'var(--accent)',
      timerRingColorEnabled: 'true',
      trashRetentionDays: -10,
      reminderMode: 'multiply',
      projectionDisplayId: '../bad'
    })

    expect(normalized).toMatchObject({
      timezone: 'Asia/Taipei',
      hardwareAcceleration: true,
      themePreference: 'system',
      timerRingColor: '#3b82f6',
      timerRingColorEnabled: false,
      trashRetentionDays: 0,
      reminderMode: 'subtract',
      projectionDisplayId: ''
    })
  })

  it('normalizes valid projection display ids', () => {
    expect(normalizeSettingsState({ projectionDisplayId: '2' }).projectionDisplayId).toBe('2')
    expect(normalizeSettingsState({ projectionDisplayId: '' }).projectionDisplayId).toBe('')
  })
})

describe('AZURE_REGION_OPTIONS', () => {
  it('contains 34 regions', () => {
    expect(AZURE_REGION_OPTIONS).toHaveLength(34)
  })

  it('includes eastasia region', () => {
    const hasEastAsia = AZURE_REGION_OPTIONS.some((r) => r.value === 'eastasia')
    expect(hasEastAsia).toBe(true)
  })

  it('all regions have value and label', () => {
    AZURE_REGION_OPTIONS.forEach((region) => {
      expect(region.value).toBeTruthy()
      expect(region.label).toBeTruthy()
      expect(typeof region.value).toBe('string')
      expect(typeof region.label).toBe('string')
    })
  })

  it('has unique region values', () => {
    const values = AZURE_REGION_OPTIONS.map((r) => r.value)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)
  })
})
