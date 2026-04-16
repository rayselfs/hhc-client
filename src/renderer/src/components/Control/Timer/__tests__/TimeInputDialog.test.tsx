import { render, screen, fireEvent } from '@testing-library/react'
import TimeInputDialog from '../TimeInputDialog'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const onClose = vi.fn()
const onConfirm = vi.fn()

function setup(isOpen = true, initialValue?: string): void {
  render(
    <ShortcutScopeProvider>
      <TimeInputDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onConfirm}
        initialValue={initialValue}
      />
    </ShortcutScopeProvider>
  )
}

describe('TimeInputDialog', () => {
  beforeEach(() => {
    onClose.mockClear()
    onConfirm.mockClear()
  })

  it('renders when open', () => {
    setup(true)
    expect(screen.getByPlaceholderText('timer.inputDialog.placeholder')).toBeInTheDocument()
  })

  it('does not render input when closed', () => {
    setup(false)
    expect(screen.queryByPlaceholderText('timer.inputDialog.placeholder')).not.toBeInTheDocument()
  })

  it('accepts 1m30s → calls onConfirm(90)', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '1m30s' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).toHaveBeenCalledWith(90)
    expect(onClose).toHaveBeenCalled()
  })

  it('accepts 03:00 → calls onConfirm(180)', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '03:00' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).toHaveBeenCalledWith(180)
  })

  it('accepts 90s → calls onConfirm(90)', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '90s' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).toHaveBeenCalledWith(90)
  })

  it('shows error for invalid input', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('timer.inputDialog.invalid')).toBeInTheDocument()
  })

  it('calls onClose on Cancel', () => {
    setup()
    fireEvent.click(screen.getByText('common.cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('pre-fills with initialValue', () => {
    setup(true, '05:00')
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('05:00')
  })

  it('submits on Enter key', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '2m' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith(120)
  })

  it('closes on Escape key', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error when duration exceeds 59:59', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '99:00' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('timer.inputDialog.exceedsMax')).toBeInTheDocument()
  })

  it('accepts exactly 59:59 (3599 seconds)', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '59:59' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).toHaveBeenCalledWith(3599)
  })

  it('shows error for 60:00 (3600 seconds)', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '60:00' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('timer.inputDialog.exceedsMax')).toBeInTheDocument()
  })
})
