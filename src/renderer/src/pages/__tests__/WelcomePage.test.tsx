import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import WelcomePage from '../WelcomePage'

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
    { value: 'UTC', labelKey: 'timezones.utc' }
  ]
}))

vi.mock('@renderer/lib/onboarding', () => ({
  markOnboarded: vi.fn()
}))

function renderWelcomePage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <WelcomePage />
    </MemoryRouter>
  )
}

describe('WelcomePage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage('en')
  })

  it('renders the welcome page root element', () => {
    renderWelcomePage()
    expect(screen.getByTestId('welcome-page')).toBeInTheDocument()
  })

  it('renders language and timezone selectors', () => {
    renderWelcomePage()
    expect(screen.getByLabelText(i18n.t('welcome.language'))).toBeInTheDocument()
    expect(screen.getByLabelText(i18n.t('welcome.timezone'))).toBeInTheDocument()
  })

  it('no skip or cancel button present', () => {
    renderWelcomePage()
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('confirm button exists', () => {
    renderWelcomePage()
    expect(screen.getByRole('button', { name: i18n.t('welcome.confirm') })).toBeInTheDocument()
  })
})
