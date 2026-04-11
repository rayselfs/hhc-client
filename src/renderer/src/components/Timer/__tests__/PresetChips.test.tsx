import { render, screen, fireEvent } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import PresetChips from '@renderer/components/Timer/PresetChips'
import { useTimerStore } from '@renderer/stores/timer'
import type { TimerPreset } from '@shared/types/timer'

const SAMPLE_PRESETS: TimerPreset[] = [
  { id: 'preset-10m', name: '10:00', durationSeconds: 600, mode: 'timer' },
  { id: 'preset-5m', name: '05:00', durationSeconds: 300, mode: 'timer' },
  { id: 'preset-3m', name: '03:00', durationSeconds: 180, mode: 'timer' }
]

function mockLocalStorage(): {
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  removeItem: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  length: number
  key: ReturnType<typeof vi.fn>
} {
  return {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', mockLocalStorage())
  useTimerStore.setState({
    presets: SAMPLE_PRESETS,
    totalDuration: 300,
    status: 'stopped'
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderWithI18n(): RenderResult {
  return render(
    <I18nextProvider i18n={i18n}>
      <PresetChips />
    </I18nextProvider>
  )
}

describe('PresetChips — rendering', () => {
  it('renders all 3 default preset chips', () => {
    renderWithI18n()
    expect(screen.getByRole('button', { name: '10:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '05:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '03:00' })).toBeInTheDocument()
  })

  it('renders an add preset button', () => {
    renderWithI18n()
    expect(screen.getByRole('button', { name: 'Add Preset' })).toBeInTheDocument()
  })

  it('does not render inline delete buttons', () => {
    renderWithI18n()
    expect(screen.queryByRole('button', { name: /delete preset/i })).not.toBeInTheDocument()
  })
})

describe('PresetChips — applyPreset', () => {
  it('clicking chip label calls applyPreset with correct id', async () => {
    const user = userEvent.setup()
    const applyPresetSpy = vi.fn()
    useTimerStore.setState({ applyPreset: applyPresetSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '05:00' }))
    expect(applyPresetSpy).toHaveBeenCalledWith('preset-5m')
  })

  it('clicking 10m chip calls applyPreset with preset-10m id', async () => {
    const user = userEvent.setup()
    const applyPresetSpy = vi.fn()
    useTimerStore.setState({ applyPreset: applyPresetSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '10:00' }))
    expect(applyPresetSpy).toHaveBeenCalledWith('preset-10m')
  })
})

describe('PresetChips — removePreset via right-click', () => {
  it('right-clicking chip directly calls removePreset with correct id', () => {
    const removePresetSpy = vi.fn()
    useTimerStore.setState({ removePreset: removePresetSpy } as never)
    renderWithI18n()

    const chip =
      screen.getByRole('button', { name: '05:00' }).closest('li') ??
      screen.getByRole('button', { name: '05:00' }).parentElement!
    fireEvent.contextMenu(chip)

    expect(removePresetSpy).toHaveBeenCalledWith('preset-5m')
  })

  it('right-clicking 10m chip calls removePreset with preset-10m', () => {
    const removePresetSpy = vi.fn()
    useTimerStore.setState({ removePreset: removePresetSpy } as never)
    renderWithI18n()

    const chip =
      screen.getByRole('button', { name: '10:00' }).closest('li') ??
      screen.getByRole('button', { name: '10:00' }).parentElement!
    fireEvent.contextMenu(chip)

    expect(removePresetSpy).toHaveBeenCalledWith('preset-10m')
  })

  it('right-clicking while running does not call removePreset', () => {
    const removePresetSpy = vi.fn()
    useTimerStore.setState({ removePreset: removePresetSpy, status: 'running' } as never)
    renderWithI18n()

    const chip = screen.getByRole('button', { name: '05:00' }).parentElement!
    fireEvent.contextMenu(chip)

    expect(removePresetSpy).not.toHaveBeenCalled()
  })
})

describe('PresetChips — addPreset (current duration)', () => {
  it('clicking add button calls addPreset with auto-generated name and totalDuration', async () => {
    const user = userEvent.setup()
    const addPresetSpy = vi.fn()
    useTimerStore.setState({
      addPreset: addPresetSpy,
      totalDuration: 90,
      presets: SAMPLE_PRESETS
    } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: 'Add Preset' }))
    expect(addPresetSpy).toHaveBeenCalledWith('01:30', 90)
  })

  it('add button is disabled when totalDuration already exists in presets', () => {
    useTimerStore.setState({ totalDuration: 300, presets: SAMPLE_PRESETS })
    renderWithI18n()
    expect(screen.getByRole('button', { name: 'Add Preset' })).toBeDisabled()
  })

  it('add button is enabled when totalDuration does not exist in presets', () => {
    useTimerStore.setState({ totalDuration: 90, presets: SAMPLE_PRESETS })
    renderWithI18n()
    expect(screen.getByRole('button', { name: 'Add Preset' })).not.toBeDisabled()
  })

  it('does not call addPreset when duration already exists', async () => {
    const user = userEvent.setup()
    const addPresetSpy = vi.fn()
    useTimerStore.setState({
      addPreset: addPresetSpy,
      totalDuration: 300,
      presets: SAMPLE_PRESETS
    } as never)
    renderWithI18n()
    const addBtn = screen.getByRole('button', { name: 'Add Preset' })
    await user.click(addBtn)
    expect(addPresetSpy).not.toHaveBeenCalled()
  })
})

describe('PresetChips — disabled while running', () => {
  it('add button is disabled when timer is running', () => {
    useTimerStore.setState({ totalDuration: 90, presets: SAMPLE_PRESETS, status: 'running' })
    renderWithI18n()
    expect(screen.getByRole('button', { name: 'Add Preset' })).toBeDisabled()
  })

  it('add button is disabled when timer is paused', () => {
    useTimerStore.setState({ totalDuration: 90, presets: SAMPLE_PRESETS, status: 'paused' })
    renderWithI18n()
    expect(screen.getByRole('button', { name: 'Add Preset' })).toBeDisabled()
  })

  it('preset chips are not clickable when timer is running', async () => {
    const user = userEvent.setup()
    const applyPresetSpy = vi.fn()
    useTimerStore.setState({
      applyPreset: applyPresetSpy,
      presets: SAMPLE_PRESETS,
      status: 'running'
    } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '05:00' }))
    expect(applyPresetSpy).not.toHaveBeenCalled()
  })
})
