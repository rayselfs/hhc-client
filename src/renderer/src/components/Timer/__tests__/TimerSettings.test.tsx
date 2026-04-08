import { render, screen } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import TimerSettings from '@renderer/components/Timer/TimerSettings'
import { useTimerStore } from '@renderer/stores/timer'
import { DEFAULT_SETTINGS, DEFAULT_STATE } from '@renderer/stores/timer'

beforeEach(() => {
  useTimerStore.setState({
    ...DEFAULT_SETTINGS,
    ...DEFAULT_STATE,
    targetEndTime: null,
    totalDuration: 300,
    reminderEnabled: false,
    reminderDuration: 60,
    overtimeMessageEnabled: false,
    overtimeMessage: "Time's Up!"
  })
})

function renderWithI18n(): RenderResult {
  return render(
    <I18nextProvider i18n={i18n}>
      <TimerSettings />
    </I18nextProvider>
  )
}

async function openPanel(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const btn = screen.getByRole('button', { name: /settings/i })
  await user.click(btn)
}

describe('TimerSettings — panel toggle', () => {
  it('panel is hidden by default', () => {
    renderWithI18n()
    expect(screen.queryByRole('region', { name: /settings/i })).not.toBeInTheDocument()
  })

  it('clicking settings button opens panel', async () => {
    const user = userEvent.setup()
    renderWithI18n()
    await openPanel(user)
    expect(screen.getByRole('region', { name: /settings/i })).toBeInTheDocument()
  })

  it('clicking settings button again closes panel', async () => {
    const user = userEvent.setup()
    renderWithI18n()
    await openPanel(user)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.queryByRole('region', { name: /settings/i })).not.toBeInTheDocument()
  })
})

describe('TimerSettings — reminder toggle', () => {
  it('toggling reminder switch calls setReminder with new enabled state', async () => {
    const user = userEvent.setup()
    const setReminderSpy = vi.fn()
    useTimerStore.setState({ setReminder: setReminderSpy } as never)
    renderWithI18n()
    await openPanel(user)

    const switches = screen.getAllByRole('switch')
    const reminderSwitch = switches[0]
    await user.click(reminderSwitch)

    expect(setReminderSpy).toHaveBeenCalledWith(true, 60)
  })

  it('toggling reminder from enabled to disabled calls setReminder(false, duration)', async () => {
    const user = userEvent.setup()
    const setReminderSpy = vi.fn()
    useTimerStore.setState({
      reminderEnabled: true,
      reminderDuration: 30,
      setReminder: setReminderSpy
    } as never)
    renderWithI18n()
    await openPanel(user)

    const switches = screen.getAllByRole('switch')
    const reminderSwitch = switches[0]
    await user.click(reminderSwitch)

    expect(setReminderSpy).toHaveBeenCalledWith(false, 30)
  })
})

describe('TimerSettings — reminder duration input', () => {
  it('changing reminder duration calls setReminder with new seconds', async () => {
    const user = userEvent.setup()
    const setReminderSpy = vi.fn()
    useTimerStore.setState({
      reminderEnabled: true,
      reminderDuration: 0,
      setReminder: setReminderSpy
    } as never)
    renderWithI18n()
    await openPanel(user)

    const durationInput = screen.getByRole('spinbutton', { name: /reminder time/i })
    await user.tripleClick(durationInput)
    await user.keyboard('9')

    expect(setReminderSpy).toHaveBeenLastCalledWith(true, 9)
  })

  it('shows validation error when reminderDuration >= totalDuration', async () => {
    const user = userEvent.setup()
    useTimerStore.setState({
      reminderEnabled: true,
      reminderDuration: 300,
      totalDuration: 300
    })
    renderWithI18n()
    await openPanel(user)

    expect(screen.getByRole('alert')).toHaveTextContent(/less than total duration/i)
  })

  it('shows no error when reminderDuration < totalDuration', async () => {
    const user = userEvent.setup()
    useTimerStore.setState({
      reminderEnabled: true,
      reminderDuration: 60,
      totalDuration: 300
    })
    renderWithI18n()
    await openPanel(user)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows no error when reminder is disabled even if duration >= totalDuration', async () => {
    const user = userEvent.setup()
    useTimerStore.setState({
      reminderEnabled: false,
      reminderDuration: 300,
      totalDuration: 300
    })
    renderWithI18n()
    await openPanel(user)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('TimerSettings — overtime message toggle', () => {
  it('toggling overtime switch calls setOvertimeMessage with new enabled state', async () => {
    const user = userEvent.setup()
    const setOvertimeMessageSpy = vi.fn()
    useTimerStore.setState({ setOvertimeMessage: setOvertimeMessageSpy } as never)
    renderWithI18n()
    await openPanel(user)

    const switches = screen.getAllByRole('switch')
    const overtimeSwitch = switches[1]
    await user.click(overtimeSwitch)

    expect(setOvertimeMessageSpy).toHaveBeenCalledWith(true, "Time's Up!")
  })

  it('toggling overtime from enabled to disabled calls setOvertimeMessage(false, message)', async () => {
    const user = userEvent.setup()
    const setOvertimeMessageSpy = vi.fn()
    useTimerStore.setState({
      overtimeMessageEnabled: true,
      overtimeMessage: 'Custom!',
      setOvertimeMessage: setOvertimeMessageSpy
    } as never)
    renderWithI18n()
    await openPanel(user)

    const switches = screen.getAllByRole('switch')
    const overtimeSwitch = switches[1]
    await user.click(overtimeSwitch)

    expect(setOvertimeMessageSpy).toHaveBeenCalledWith(false, 'Custom!')
  })
})

describe('TimerSettings — overtime message text input', () => {
  it('changing overtime message text calls setOvertimeMessage', async () => {
    const user = userEvent.setup()
    const setOvertimeMessageSpy = vi.fn()
    useTimerStore.setState({
      overtimeMessageEnabled: true,
      overtimeMessage: '',
      setOvertimeMessage: setOvertimeMessageSpy
    } as never)
    renderWithI18n()
    await openPanel(user)

    const messageInputs = screen.getAllByRole('textbox')
    const overtimeInput = messageInputs[0]
    await user.type(overtimeInput, 'Hi')

    expect(setOvertimeMessageSpy).toHaveBeenCalled()
  })

  it('enforces max 15 char limit on overtime message', async () => {
    const user = userEvent.setup()
    const setOvertimeMessageSpy = vi.fn()
    useTimerStore.setState({
      overtimeMessageEnabled: false,
      overtimeMessage: '',
      setOvertimeMessage: setOvertimeMessageSpy
    } as never)
    renderWithI18n()
    await openPanel(user)

    const messageInputs = screen.getAllByRole('textbox')
    const overtimeInput = messageInputs[0]
    await user.type(overtimeInput, 'ABCDEFGHIJKLMNOPQRSTU')

    const calls = setOvertimeMessageSpy.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[1].length).toBeLessThanOrEqual(15)
  })
})
