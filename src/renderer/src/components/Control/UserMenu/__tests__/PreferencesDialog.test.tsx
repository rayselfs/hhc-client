import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import ConfirmDialog from '../../../Common/ConfirmDialog'
import PreferencesDialog from '../PreferencesDialog'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn().mockReturnValue(false),
  isWeb: vi.fn().mockReturnValue(true)
}))

vi.mock('@renderer/lib/speech-key-storage', () => ({
  saveSpeechKey: vi.fn().mockResolvedValue(undefined),
  loadSpeechKey: vi.fn().mockResolvedValue(null),
  deleteSpeechKey: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@renderer/lib/media-storage-accounting', () => ({
  getMediaStorageAccounting: vi.fn().mockResolvedValue({
    usage: {
      electronNativeSourceMedia: 0,
      webIndexedDbSourceBlobs: 0,
      legacyElectronIndexedDbBlobs: 0,
      generatedCoverThumbnails: 0,
      customCoverOverrides: 0,
      pdfPageThumbnails: 0,
      videoPosters: 0,
      transcodedDerivatives: 0,
      syncCache: 0,
      temporaryAndFailedJobFiles: 0
    },
    total: 0,
    browser: null
  })
}))

vi.mock('@renderer/lib/media-storage-cleanup', () => ({
  clearRegenerableDerivedAssets: vi.fn().mockResolvedValue(undefined),
  clearUnpinnedSyncCache: vi.fn().mockResolvedValue(undefined),
  removeUnusedDerivedAssets: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@renderer/stores/settings', () => ({
  DEFAULT_ONEDRIVE: {
    customClientId: '',
    defaultOfflinePolicy: 'always-offline'
  },
  HHC_DEFAULT_ONEDRIVE_CLIENT_ID: '4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02',
  getEffectiveOneDriveClientId: (settings: { customClientId: string }) =>
    settings.customClientId || '4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02',
  validateOneDriveClientId: (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  useSettingsStore: vi.fn((selector) => {
    const store = {
      timezone: 'Asia/Taipei',
      hardwareAcceleration: true,
      reminderMode: 'subtract' as const,
      setReminderMode: vi.fn(),
      speech: {
        activeProvider: 'azure' as const,
        azure: { region: 'eastasia', language: 'zh-TW' as const },
        gcp: { language: 'cmn-Hant-TW' as const },
        whisper: { modelDir: '', installedModel: null }
      },
      setTimezone: vi.fn(),
      setHardwareAcceleration: vi.fn(),
      setSpeech: vi.fn(),
      oneDrive: {
        customClientId: '',
        defaultOfflinePolicy: 'always-offline' as const
      },
      setOneDrive: vi.fn(),
      trashRetentionDays: 30,
      setTrashRetentionDays: vi.fn(),
      resetSettings: vi.fn(),
      resetToDefaults: vi.fn()
    }
    return selector ? selector(store) : store
  }),
  TIMEZONE_OPTIONS: [
    { value: 'Asia/Taipei', labelKey: 'timezones.taipei' },
    { value: 'Europe/London', labelKey: 'timezones.london' }
  ],
  AZURE_REGION_OPTIONS: [
    { value: 'eastasia', label: 'East Asia' },
    { value: 'southeastasia', label: 'Southeast Asia' }
  ]
}))

vi.mock('@renderer/contexts/ThemeContext', () => ({
  useTheme: vi.fn()
}))

function renderDialog(isOpen: boolean, onOpenChange = vi.fn()): ReturnType<typeof render> {
  return render(
    <ShortcutScopeProvider>
      <MemoryRouter>
        <ConfirmDialogProvider>
          <PreferencesDialog isOpen={isOpen} onOpenChange={onOpenChange} />
          <ConfirmDialog />
        </ConfirmDialogProvider>
      </MemoryRouter>
    </ShortcutScopeProvider>
  )
}

describe('PreferencesDialog', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')

    const { isElectron } = await import('@renderer/lib/env')
    vi.mocked(isElectron).mockReturnValue(false)

    const { useTheme } = await import('@renderer/contexts/ThemeContext')
    vi.mocked(useTheme).mockReturnValue({
      preference: 'light',
      resolved: 'light',
      setPreference: vi.fn()
    })
  })

  it('renders when isOpen is true', () => {
    renderDialog(true)
    expect(screen.getByTestId('category-general')).toBeInTheDocument()
    expect(screen.getByTestId('category-timer')).toBeInTheDocument()
    expect(screen.getByTestId('category-bible')).toBeInTheDocument()
    expect(screen.getByTestId('category-media')).toBeInTheDocument()
    expect(screen.getByTestId('category-storage')).toBeInTheDocument()
  })

  it('does not render content when isOpen is false', () => {
    renderDialog(false)
    expect(screen.queryByTestId('category-general')).not.toBeInTheDocument()
  })

  it('shows general settings by default', () => {
    renderDialog(true)
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
    expect(screen.queryByLabelText('Timezone')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dark Mode')).toBeInTheDocument()
  })

  it('navigates to timer category and shows Timer settings', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByTestId('category-timer'))
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument()
    expect(screen.getByLabelText('Time Warning Calculation')).toBeInTheDocument()
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('category-general'))
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
  })

  it('navigates to media category and back', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByTestId('category-media'))
    expect(screen.getByTestId('category-media')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('Trash Retention Period')).toBeInTheDocument()
    expect(screen.getByTestId('category-media-general')).toBeInTheDocument()
    expect(screen.getByTestId('category-media-oneDrive')).toBeInTheDocument()
    expect(screen.queryByTestId('category-media-video')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('category-general'))
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
  })

  it('collapses media children when another top-level category is selected', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByTestId('category-media'))
    expect(screen.getByTestId('category-media-general')).toBeInTheDocument()

    await user.click(screen.getByTestId('category-timer'))
    expect(screen.queryByTestId('category-media-general')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument()
  })

  it('navigates between media child sections', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByTestId('category-media'))
    await user.click(screen.getByTestId('category-media-oneDrive'))
    expect(screen.getByTestId('category-media')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('category-media-oneDrive')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Custom Azure Client ID')).toBeInTheDocument()
    expect(screen.queryByLabelText('Azure Application Client ID')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Trash Retention Period')).not.toBeInTheDocument()
  })

  it('shows video transcoding media section only on Electron', async () => {
    const user = userEvent.setup()
    const { isElectron } = await import('@renderer/lib/env')
    vi.mocked(isElectron).mockReturnValue(true)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoTranscode: {
          getFfmpegConfig: vi.fn().mockResolvedValue({ status: 'not-configured' }),
          selectFfmpeg: vi.fn(),
          validateFfmpeg: vi.fn(),
          removeFfmpegConfig: vi.fn()
        }
      }
    })

    renderDialog(true)

    await user.click(screen.getByTestId('category-media'))
    expect(screen.getByTestId('category-media-video')).toBeInTheDocument()

    await user.click(screen.getByTestId('category-media-video'))
    expect(screen.getByRole('heading', { name: 'Video Transcoding' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Azure Application Client ID')).not.toBeInTheDocument()

    vi.mocked(isElectron).mockReturnValue(false)
  })

  it('does not show FFmpeg select action while config detection is pending', async () => {
    const user = userEvent.setup()
    const { isElectron } = await import('@renderer/lib/env')
    vi.mocked(isElectron).mockReturnValue(true)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoTranscode: {
          getFfmpegConfig: vi.fn(() => new Promise(() => {})),
          selectFfmpeg: vi.fn(),
          validateFfmpeg: vi.fn(),
          removeFfmpegConfig: vi.fn()
        }
      }
    })

    renderDialog(true)

    await user.click(screen.getByTestId('category-media'))
    await user.click(screen.getByTestId('category-media-video'))

    expect(screen.getByRole('heading', { name: 'Video Transcoding' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Select FFmpeg' })).not.toBeInTheDocument()

    vi.mocked(isElectron).mockReturnValue(false)
  })

  it('navigates between storage child sections', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByTestId('category-storage'))
    expect(screen.getByTestId('category-storage')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('category-storage-usage')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Usage' })).toBeInTheDocument()
    expect(screen.getByText('Original media files')).toBeInTheDocument()
    expect(screen.queryByText('Video Transcoding')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('category-storage-cleanup'))
    expect(screen.getByTestId('category-storage')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('category-storage-cleanup')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Cache Cleanup' })).toBeInTheDocument()
    expect(screen.getByText('Clear orphan derived assets')).toBeInTheDocument()
    expect(screen.getByText(/covers, PDF previews, video posters/)).toBeInTheDocument()
  })

  it('navigates to bible category and shows Bible settings', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByTestId('category-bible'))
    expect(await screen.findByText('Test Connection')).toBeInTheDocument()
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('category-general'))
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
  })

  it('calls i18n.changeLanguage when language option clicked', async () => {
    const user = userEvent.setup()
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage')
    renderDialog(true)

    const zhTWButton = screen.getByText('繁體中文')
    await user.click(zhTWButton)
    expect(changeLanguageSpy).toHaveBeenCalledWith('zh-TW')
  })

  it('calls setTimezone when timezone option clicked', async () => {
    const user = userEvent.setup()
    const { useSettingsStore } = await import('@renderer/stores/settings')
    const setTimezone = vi.fn()
    vi.mocked(useSettingsStore).mockImplementation((selector) => {
      const store = {
        timezone: 'Asia/Taipei',
        hardwareAcceleration: true,
        setTimezone,
        setHardwareAcceleration: vi.fn(),
        resetSettings: vi.fn(),
        resetToDefaults: vi.fn(),
        themePreference: 'system' as const,
        setThemePreference: vi.fn(),
        timerRingColor: '#3b82f6',
        setTimerRingColor: vi.fn(),
        timerRingColorEnabled: false,
        setTimerRingColorEnabled: vi.fn(),
        reminderMode: 'subtract' as const,
        setReminderMode: vi.fn(),
        speech: {
          activeProvider: 'azure' as const,
          azure: { region: 'eastasia', language: 'zh-TW' as const },
          gcp: { language: 'cmn-Hant-TW' as const },
          whisper: { modelDir: '', installedModel: null }
        },
        setSpeech: vi.fn(),
        oneDrive: {
          customClientId: '',
          defaultOfflinePolicy: 'always-offline' as const
        },
        setOneDrive: vi.fn(),
        trashRetentionDays: 30,
        setTrashRetentionDays: vi.fn(),
        projectionDisplayId: '',
        setProjectionDisplayId: vi.fn()
      }
      return selector ? selector(store) : store
    })

    renderDialog(true)

    // Navigate to timer category
    await user.click(screen.getByTestId('category-timer'))

    const londonButton = screen.getByText('London (UTC+0/+1)')
    await user.click(londonButton)
    expect(setTimezone).toHaveBeenCalledWith('Europe/London')
  })

  it('calls setPreference when dark mode switch clicked', async () => {
    const user = userEvent.setup()
    const { useTheme } = await import('@renderer/contexts/ThemeContext')
    const setPreference = vi.fn()
    vi.mocked(useTheme).mockReturnValue({
      preference: 'light',
      resolved: 'light',
      setPreference
    })

    renderDialog(true)

    const darkModeSwitch = screen.getByRole('switch', { name: 'Dark Mode' })
    await user.click(darkModeSwitch)
    expect(setPreference).toHaveBeenCalledWith('dark')
  })

  it('hides hardware acceleration switch on web', () => {
    renderDialog(true)
    expect(screen.queryByLabelText('Hardware Acceleration')).not.toBeInTheDocument()
  })

  it('shows hardware acceleration switch on Electron', async () => {
    const { isElectron } = await import('@renderer/lib/env')
    vi.mocked(isElectron).mockReturnValue(true)

    renderDialog(true)
    expect(screen.getByLabelText('Hardware Acceleration')).toBeInTheDocument()

    vi.mocked(isElectron).mockReturnValue(false)
  })

  it('disables projection display selector when no external display exists', async () => {
    const { isElectron } = await import('@renderer/lib/env')
    vi.mocked(isElectron).mockReturnValue(true)
    Object.defineProperty(window, 'api', {
      value: { projection: { getDisplays: vi.fn().mockResolvedValue([]) } },
      configurable: true
    })

    renderDialog(true)

    expect(await screen.findByText('No external display')).toBeInTheDocument()
    expect(screen.getByLabelText('Projection Window Display')).toHaveAttribute(
      'aria-disabled',
      'true'
    )

    vi.mocked(isElectron).mockReturnValue(false)
  })

  it('calls resetSettings when reset settings confirmed via modal', async () => {
    const user = userEvent.setup()
    const { useSettingsStore } = await import('@renderer/stores/settings')
    const { useTheme } = await import('@renderer/contexts/ThemeContext')

    const resetSettings = vi.fn()
    const resetToDefaults = vi.fn()
    const setPreference = vi.fn()
    const onOpenChange = vi.fn()

    vi.mocked(useSettingsStore).mockImplementation((selector) => {
      const store = {
        timezone: 'Asia/Taipei',
        hardwareAcceleration: true,
        setTimezone: vi.fn(),
        setHardwareAcceleration: vi.fn(),
        resetSettings,
        resetToDefaults,
        themePreference: 'system' as const,
        setThemePreference: vi.fn(),
        timerRingColor: '#3b82f6',
        setTimerRingColor: vi.fn(),
        timerRingColorEnabled: false,
        setTimerRingColorEnabled: vi.fn(),
        reminderMode: 'subtract' as const,
        setReminderMode: vi.fn(),
        speech: {
          activeProvider: 'azure' as const,
          azure: { region: 'eastasia', language: 'zh-TW' as const },
          gcp: { language: 'cmn-Hant-TW' as const },
          whisper: { modelDir: '', installedModel: null }
        },
        setSpeech: vi.fn(),
        oneDrive: {
          customClientId: '',
          defaultOfflinePolicy: 'always-offline' as const
        },
        setOneDrive: vi.fn(),
        trashRetentionDays: 30,
        setTrashRetentionDays: vi.fn(),
        projectionDisplayId: '',
        setProjectionDisplayId: vi.fn()
      }
      return selector ? selector(store) : store
    })
    vi.mocked(useTheme).mockReturnValue({
      preference: 'dark',
      resolved: 'dark',
      setPreference
    })

    renderDialog(true, onOpenChange)

    const resetButton = screen.getAllByText('Reset Settings').at(-1)!
    await user.click(resetButton)

    const allResetButtons = await screen.findAllByText('Reset Settings')
    await user.click(allResetButtons[allResetButtons.length - 1])

    expect(resetSettings).toHaveBeenCalled()
    expect(resetToDefaults).not.toHaveBeenCalled()
  })

  it('calls resetToDefaults when clear all data confirmed via modal', async () => {
    const user = userEvent.setup()
    const { useSettingsStore } = await import('@renderer/stores/settings')

    const resetToDefaults = vi.fn()

    vi.mocked(useSettingsStore).mockImplementation((selector) => {
      const store = {
        timezone: 'Asia/Taipei',
        hardwareAcceleration: true,
        setTimezone: vi.fn(),
        setHardwareAcceleration: vi.fn(),
        resetSettings: vi.fn(),
        resetToDefaults,
        themePreference: 'system' as const,
        setThemePreference: vi.fn(),
        timerRingColor: '#3b82f6',
        setTimerRingColor: vi.fn(),
        timerRingColorEnabled: false,
        setTimerRingColorEnabled: vi.fn(),
        reminderMode: 'subtract' as const,
        setReminderMode: vi.fn(),
        speech: {
          activeProvider: 'azure' as const,
          azure: { region: 'eastasia', language: 'zh-TW' as const },
          gcp: { language: 'cmn-Hant-TW' as const },
          whisper: { modelDir: '', installedModel: null }
        },
        setSpeech: vi.fn(),
        oneDrive: {
          customClientId: '',
          defaultOfflinePolicy: 'always-offline' as const
        },
        setOneDrive: vi.fn(),
        trashRetentionDays: 30,
        setTrashRetentionDays: vi.fn(),
        projectionDisplayId: '',
        setProjectionDisplayId: vi.fn()
      }
      return selector ? selector(store) : store
    })

    renderDialog(true)

    await user.click(screen.getAllByText('Clear All Data').at(-1)!)
    const allClearButtons = await screen.findAllByText('Clear All Data')
    await user.click(allClearButtons[allClearButtons.length - 1])

    expect(resetToDefaults).toHaveBeenCalled()
  })

  it('does not reset when cancel clicked in modal', async () => {
    const user = userEvent.setup()
    const { useSettingsStore } = await import('@renderer/stores/settings')
    const resetToDefaults = vi.fn()

    vi.mocked(useSettingsStore).mockImplementation((selector) => {
      const store = {
        timezone: 'Asia/Taipei',
        hardwareAcceleration: true,
        setTimezone: vi.fn(),
        setHardwareAcceleration: vi.fn(),
        resetSettings: vi.fn(),
        resetToDefaults,
        themePreference: 'system' as const,
        setThemePreference: vi.fn(),
        timerRingColor: '#3b82f6',
        setTimerRingColor: vi.fn(),
        timerRingColorEnabled: false,
        setTimerRingColorEnabled: vi.fn(),
        reminderMode: 'subtract' as const,
        setReminderMode: vi.fn(),
        speech: {
          activeProvider: 'azure' as const,
          azure: { region: 'eastasia', language: 'zh-TW' as const },
          gcp: { language: 'cmn-Hant-TW' as const },
          whisper: { modelDir: '', installedModel: null }
        },
        setSpeech: vi.fn(),
        oneDrive: {
          customClientId: '',
          defaultOfflinePolicy: 'always-offline' as const
        },
        setOneDrive: vi.fn(),
        trashRetentionDays: 30,
        setTrashRetentionDays: vi.fn(),
        projectionDisplayId: '',
        setProjectionDisplayId: vi.fn()
      }
      return selector ? selector(store) : store
    })

    renderDialog(true)

    const resetButton = screen.getAllByText('Reset Settings').at(-1)!
    await user.click(resetButton)

    const cancelButton = await screen.findByText('Cancel')
    await user.click(cancelButton)

    expect(resetToDefaults).not.toHaveBeenCalled()
  })
})
