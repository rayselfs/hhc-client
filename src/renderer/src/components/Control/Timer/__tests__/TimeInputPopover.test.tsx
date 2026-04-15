import { render, screen, fireEvent } from '@testing-library/react'
import TimeInputPopover from '../TimeInputPopover'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

const onConfirm = vi.fn()

function setup(): void {
  render(
    <TimeInputPopover onConfirm={onConfirm}>
      <button>Open</button>
    </TimeInputPopover>
  )
  fireEvent.click(screen.getByText('Open'))
}

describe('TimeInputPopover', () => {
  beforeEach(() => {
    onConfirm.mockClear()
  })

  it('accepts valid input', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '5:00' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).toHaveBeenCalledWith(300)
  })

  it('shows error when duration exceeds 59:59', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '99:00' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('timer.inputDialog.exceedsMax')).toBeInTheDocument()
  })

  it('accepts exactly 59:59', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '59:59' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).toHaveBeenCalledWith(3599)
  })

  it('shows error for invalid input', () => {
    setup()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('timer.inputDialog.confirm'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('timer.inputDialog.invalid')).toBeInTheDocument()
  })
})
