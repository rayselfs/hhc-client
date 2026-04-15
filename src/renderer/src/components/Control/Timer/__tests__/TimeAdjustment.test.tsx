import { render, screen } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import TimeAdjustment from '@renderer/components/Control/Timer/TimeAdjustment'
import { useTimerStore } from '@renderer/stores/timer'

beforeEach(() => {
  useTimerStore.setState({ remainingSeconds: 300, status: 'stopped' })
})

function renderWithI18n(): RenderResult {
  return render(
    <I18nextProvider i18n={i18n}>
      <TimeAdjustment />
    </I18nextProvider>
  )
}

describe('TimeAdjustment — add time buttons', () => {
  it('+30s button calls addTime(30)', async () => {
    const user = userEvent.setup()
    const addTimeSpy = vi.fn()
    useTimerStore.setState({ addTime: addTimeSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '+30' }))
    expect(addTimeSpy).toHaveBeenCalledWith(30)
  })

  it('+10s button calls addTime(10)', async () => {
    const user = userEvent.setup()
    const addTimeSpy = vi.fn()
    useTimerStore.setState({ addTime: addTimeSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '+10' }))
    expect(addTimeSpy).toHaveBeenCalledWith(10)
  })

  it('+60s button calls addTime(60)', async () => {
    const user = userEvent.setup()
    const addTimeSpy = vi.fn()
    useTimerStore.setState({ addTime: addTimeSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '+60' }))
    expect(addTimeSpy).toHaveBeenCalledWith(60)
  })
})

describe('TimeAdjustment — remove time buttons', () => {
  it('-30s button calls removeTime(30)', async () => {
    const user = userEvent.setup()
    const removeTimeSpy = vi.fn()
    useTimerStore.setState({ remainingSeconds: 90, removeTime: removeTimeSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '-30' }))
    expect(removeTimeSpy).toHaveBeenCalledWith(30)
  })

  it('-10s button calls removeTime(10)', async () => {
    const user = userEvent.setup()
    const removeTimeSpy = vi.fn()
    useTimerStore.setState({ remainingSeconds: 90, removeTime: removeTimeSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '-10' }))
    expect(removeTimeSpy).toHaveBeenCalledWith(10)
  })
})

describe('TimeAdjustment — disabled logic', () => {
  it('remaining=20: -30s and -60s disabled, -10s NOT disabled', () => {
    useTimerStore.setState({ remainingSeconds: 20, status: 'stopped' })
    renderWithI18n()
    expect(screen.getByRole('button', { name: '-10' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '-30' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '-60' })).toBeDisabled()
  })

  it('remaining=5: all minus buttons disabled', () => {
    useTimerStore.setState({ remainingSeconds: 5, status: 'stopped' })
    renderWithI18n()
    expect(screen.getByRole('button', { name: '-10' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '-30' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '-60' })).toBeDisabled()
  })

  it('remaining=300: all minus buttons enabled', () => {
    useTimerStore.setState({ remainingSeconds: 300, status: 'stopped' })
    renderWithI18n()
    expect(screen.getByRole('button', { name: '-10' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '-30' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '-60' })).not.toBeDisabled()
  })

  it('plus buttons are never disabled by remaining time', () => {
    useTimerStore.setState({ remainingSeconds: 0, status: 'stopped' })
    renderWithI18n()
    expect(screen.getByRole('button', { name: '+10' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '+30' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '+60' })).not.toBeDisabled()
  })
})

describe('TimeAdjustment — works while running', () => {
  it('buttons are not blocked when status is running', async () => {
    const user = userEvent.setup()
    const addTimeSpy = vi.fn()
    useTimerStore.setState({
      remainingSeconds: 90,
      status: 'running',
      addTime: addTimeSpy
    } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '+30' }))
    expect(addTimeSpy).toHaveBeenCalledWith(30)
  })

  it('minus buttons respect remaining when running', () => {
    useTimerStore.setState({ remainingSeconds: 20, status: 'running' })
    renderWithI18n()
    expect(screen.getByRole('button', { name: '-10' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '-30' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '-60' })).toBeDisabled()
  })
})
