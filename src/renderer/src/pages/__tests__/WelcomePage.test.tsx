import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import WelcomePage from '../WelcomePage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

vi.mock('@renderer/stores/settings', () => {
  const setTimezone = vi.fn()
  return {
    useSettingsStore: Object.assign(
      vi.fn((selector) => {
        const store = {
          timezone: 'Asia/Taipei',
          hardwareAcceleration: true,
          setTimezone,
          setHardwareAcceleration: vi.fn(),
          resetToDefaults: vi.fn()
        }
        return selector ? selector(store) : store
      }),
      {
        getState: () => ({ setTimezone })
      }
    ),
    TIMEZONE_OPTIONS: [
      { value: 'Asia/Taipei', labelKey: 'timezones.taipei' },
      { value: 'UTC', labelKey: 'timezones.utc' }
    ]
  }
})

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

  it('clicking confirm calls markOnboarded and navigates to /timer', async () => {
    const user = userEvent.setup()
    const { markOnboarded } = await import('@renderer/lib/onboarding')
    renderWelcomePage()

    const confirmButton = screen.getByRole('button', { name: i18n.t('welcome.confirm') })
    await user.click(confirmButton)

    expect(markOnboarded).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/timer')
  })
})
