import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import PresetChips from '@renderer/components/Timer/PresetChips'
import { useTimerStore } from '@renderer/stores/timer'
import type { TimerPreset } from '@shared/types/timer'

const SAMPLE_PRESETS: TimerPreset[] = [
  { id: 'preset-10m', name: '10m', durationSeconds: 600, mode: 'timer' },
  { id: 'preset-5m', name: '5m', durationSeconds: 300, mode: 'timer' },
  { id: 'preset-3m', name: '3m', durationSeconds: 180, mode: 'timer' }
]

function mockLocalStorage() {
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

function renderWithI18n() {
  return render(
    <I18nextProvider i18n={i18n}>
      <PresetChips />
    </I18nextProvider>
  )
}

describe('PresetChips — rendering', () => {
  it('renders all 3 default preset chips', () => {
    renderWithI18n()
    expect(screen.getByRole('button', { name: '10m' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5m' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3m' })).toBeInTheDocument()
  })

  it('renders an add preset button', () => {
    renderWithI18n()
    expect(screen.getByRole('button', { name: 'Add Preset' })).toBeInTheDocument()
  })

  it('renders delete button for each preset', () => {
    renderWithI18n()
    expect(screen.getByRole('button', { name: 'Delete Preset 10m' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Preset 5m' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Preset 3m' })).toBeInTheDocument()
  })
})

describe('PresetChips — applyPreset', () => {
  it('clicking chip label calls applyPreset with correct id', async () => {
    const user = userEvent.setup()
    const applyPresetSpy = vi.fn()
    useTimerStore.setState({ applyPreset: applyPresetSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '5m' }))
    expect(applyPresetSpy).toHaveBeenCalledWith('preset-5m')
  })

  it('clicking 10m chip calls applyPreset with preset-10m id', async () => {
    const user = userEvent.setup()
    const applyPresetSpy = vi.fn()
    useTimerStore.setState({ applyPreset: applyPresetSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: '10m' }))
    expect(applyPresetSpy).toHaveBeenCalledWith('preset-10m')
  })
})

describe('PresetChips — removePreset', () => {
  it('clicking delete button calls removePreset with correct id', async () => {
    const user = userEvent.setup()
    const removePresetSpy = vi.fn()
    useTimerStore.setState({ removePreset: removePresetSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: 'Delete Preset 5m' }))
    expect(removePresetSpy).toHaveBeenCalledWith('preset-5m')
  })

  it('clicking delete for 10m calls removePreset with preset-10m', async () => {
    const user = userEvent.setup()
    const removePresetSpy = vi.fn()
    useTimerStore.setState({ removePreset: removePresetSpy } as never)
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: 'Delete Preset 10m' }))
    expect(removePresetSpy).toHaveBeenCalledWith('preset-10m')
  })
})

describe('PresetChips — addPreset', () => {
  it('clicking add button prompts for name and calls addPreset', async () => {
    const user = userEvent.setup()
    const addPresetSpy = vi.fn()
    useTimerStore.setState({ addPreset: addPresetSpy, totalDuration: 300 } as never)
    vi.stubGlobal('prompt', vi.fn().mockReturnValue('My Preset'))
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: 'Add Preset' }))
    expect(addPresetSpy).toHaveBeenCalledWith('My Preset', 300)
  })

  it('does not call addPreset when prompt is cancelled', async () => {
    const user = userEvent.setup()
    const addPresetSpy = vi.fn()
    useTimerStore.setState({ addPreset: addPresetSpy } as never)
    vi.stubGlobal('prompt', vi.fn().mockReturnValue(null))
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: 'Add Preset' }))
    expect(addPresetSpy).not.toHaveBeenCalled()
  })

  it('does not call addPreset when prompt returns empty string', async () => {
    const user = userEvent.setup()
    const addPresetSpy = vi.fn()
    useTimerStore.setState({ addPreset: addPresetSpy } as never)
    vi.stubGlobal('prompt', vi.fn().mockReturnValue('   '))
    renderWithI18n()
    await user.click(screen.getByRole('button', { name: 'Add Preset' }))
    expect(addPresetSpy).not.toHaveBeenCalled()
  })
})

describe('PresetChips — loadPresets on mount', () => {
  it('calls loadPresets on mount', () => {
    const loadPresetsSpy = vi.fn()
    useTimerStore.setState({ loadPresets: loadPresetsSpy } as never)
    renderWithI18n()
    expect(loadPresetsSpy).toHaveBeenCalledOnce()
  })
})
