import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import ConfirmDialog from '../../../Common/ConfirmDialog'
import PreferencesDialog from '../PreferencesDialog'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn().mockReturnValue(false),
  isWeb: vi.fn().mockReturnValue(true)
}))

vi.mock('@renderer/stores/settings', () => ({
  useSettingsStore: vi.fn((selector) => {
    const store = {
      timezone: 'Asia/Taipei',
      hardwareAcceleration: true,
      setTimezone: vi.fn(),
      setHardwareAcceleration: vi.fn(),
      resetToDefaults: vi.fn()
    }
    return selector ? selector(store) : store
  }),
  TIMEZONE_OPTIONS: [
    { value: 'Asia/Taipei', labelKey: 'timezones.taipei' },
    { value: 'Europe/London', labelKey: 'timezones.london' }
  ]
}))

vi.mock('@renderer/contexts/ThemeContext', () => ({
  useTheme: vi.fn()
}))

function renderDialog(isOpen: boolean, onOpenChange = vi.fn()): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <ConfirmDialogProvider>
        <PreferencesDialog isOpen={isOpen} onOpenChange={onOpenChange} />
        <ConfirmDialog />
      </ConfirmDialogProvider>
    </MemoryRouter>
  )
}

describe('PreferencesDialog', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')

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
    expect(screen.getByTestId('category-media')).toBeInTheDocument()
  })

  it('does not render content when isOpen is false', () => {
    renderDialog(false)
    expect(screen.queryByTestId('category-general')).not.toBeInTheDocument()
  })

  it('shows general settings by default', () => {
    renderDialog(true)
    expect(screen.getByLabelText('Language')).toBeInTheDocument()
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument()
    expect(screen.getByLabelText('Dark Mode')).toBeInTheDocument()
  })

  it('navigates to media category and back', async () => {
    const user = userEvent.setup()
    renderDialog(true)

    await user.click(screen.getByTestId('category-media'))
    expect(screen.getByText('Media settings coming soon')).toBeInTheDocument()
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
        resetToDefaults: vi.fn()
      }
      return selector ? selector(store) : store
    })

    renderDialog(true)

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

  it('calls reset functions when reset confirmed via modal', async () => {
    const user = userEvent.setup()
    const { useSettingsStore } = await import('@renderer/stores/settings')
    const { useTheme } = await import('@renderer/contexts/ThemeContext')

    const resetToDefaults = vi.fn()
    const setPreference = vi.fn()
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage')
    const onOpenChange = vi.fn()

    vi.mocked(useSettingsStore).mockImplementation((selector) => {
      const store = {
        timezone: 'Asia/Taipei',
        hardwareAcceleration: true,
        setTimezone: vi.fn(),
        setHardwareAcceleration: vi.fn(),
        resetToDefaults
      }
      return selector ? selector(store) : store
    })
    vi.mocked(useTheme).mockReturnValue({
      preference: 'dark',
      resolved: 'dark',
      setPreference
    })

    renderDialog(true, onOpenChange)

    const resetButton = screen.getByText('Reset')
    await user.click(resetButton)

    const allResetButtons = await screen.findAllByText('Reset')
    await user.click(allResetButtons[allResetButtons.length - 1])

    expect(resetToDefaults).toHaveBeenCalled()
    expect(setPreference).toHaveBeenCalledWith('system')
    expect(changeLanguageSpy).toHaveBeenCalledWith('en')
    expect(onOpenChange).toHaveBeenCalledWith(false)
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
        resetToDefaults
      }
      return selector ? selector(store) : store
    })

    renderDialog(true)

    const resetButton = screen.getByText('Reset')
    await user.click(resetButton)

    const cancelButton = await screen.findByText('Cancel')
    await user.click(cancelButton)

    expect(resetToDefaults).not.toHaveBeenCalled()
  })
})
