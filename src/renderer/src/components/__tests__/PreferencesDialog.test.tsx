import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import PreferencesDialog from '../PreferencesDialog'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn().mockReturnValue(false),
  isWeb: vi.fn().mockReturnValue(true)
}))

vi.mock('@renderer/stores/settings', () => ({
  useSettingsStore: vi.fn(),
  TIMEZONE_OPTIONS: [
    { value: 'Asia/Taipei', labelKey: 'timezones.taipei' },
    { value: 'UTC', labelKey: 'timezones.utc' }
  ]
}))

vi.mock('@renderer/contexts/ThemeContext', () => ({
  useTheme: vi.fn()
}))

function renderDialog(isOpen: boolean, onOpenChange = vi.fn()): ReturnType<typeof render> {
  return render(<PreferencesDialog isOpen={isOpen} onOpenChange={onOpenChange} />)
}

describe('PreferencesDialog', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')

    const { useSettingsStore } = await import('@renderer/stores/settings')
    vi.mocked(useSettingsStore).mockReturnValue({
      timezone: 'Asia/Taipei',
      hardwareAcceleration: true,
      setTimezone: vi.fn(),
      setHardwareAcceleration: vi.fn(),
      resetToDefaults: vi.fn()
    })

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
    vi.mocked(useSettingsStore).mockReturnValue({
      timezone: 'Asia/Taipei',
      hardwareAcceleration: true,
      setTimezone,
      setHardwareAcceleration: vi.fn(),
      resetToDefaults: vi.fn()
    })

    renderDialog(true)

    const utcButton = screen.getByText('UTC (UTC+0)')
    await user.click(utcButton)
    expect(setTimezone).toHaveBeenCalledWith('UTC')
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

  it('calls reset functions when reset confirmed', async () => {
    const user = userEvent.setup()
    const { useSettingsStore } = await import('@renderer/stores/settings')
    const { useTheme } = await import('@renderer/contexts/ThemeContext')

    const resetToDefaults = vi.fn()
    const setPreference = vi.fn()
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage')

    vi.mocked(useSettingsStore).mockReturnValue({
      timezone: 'Asia/Taipei',
      hardwareAcceleration: true,
      setTimezone: vi.fn(),
      setHardwareAcceleration: vi.fn(),
      resetToDefaults
    })
    vi.mocked(useTheme).mockReturnValue({
      preference: 'dark',
      resolved: 'dark',
      setPreference
    })

    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderDialog(true)

    const resetButton = screen.getByText('Reset')
    await user.click(resetButton)

    expect(resetToDefaults).toHaveBeenCalled()
    expect(setPreference).toHaveBeenCalledWith('system')
    expect(changeLanguageSpy).toHaveBeenCalledWith('en')
  })

  it('does not reset when confirm is cancelled', async () => {
    const user = userEvent.setup()
    const { useSettingsStore } = await import('@renderer/stores/settings')
    const resetToDefaults = vi.fn()

    vi.mocked(useSettingsStore).mockReturnValue({
      timezone: 'Asia/Taipei',
      hardwareAcceleration: true,
      setTimezone: vi.fn(),
      setHardwareAcceleration: vi.fn(),
      resetToDefaults
    })

    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderDialog(true)

    const resetButton = screen.getByText('Reset')
    await user.click(resetButton)

    expect(resetToDefaults).not.toHaveBeenCalled()
  })
})
