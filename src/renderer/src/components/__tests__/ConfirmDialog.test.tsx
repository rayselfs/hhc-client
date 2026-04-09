import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import '@renderer/i18n'
import ConfirmDialog from '../ConfirmDialog'

function renderConfirmDialog(
  props: Partial<{
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    description: string
    onConfirm: () => void
    confirmLabel: string
    cancelLabel: string
  }> = {}
): ReturnType<typeof render> {
  const defaults = {
    isOpen: true,
    onOpenChange: vi.fn(),
    description: 'Are you sure?',
    onConfirm: vi.fn()
  }
  return render(<ConfirmDialog {...defaults} {...props} />)
}

describe('ConfirmDialog', () => {
  it('renders when isOpen is true', () => {
    renderConfirmDialog()
    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    renderConfirmDialog({ isOpen: false })
    expect(screen.queryByText('Warning')).not.toBeInTheDocument()
  })

  it('displays the description text', () => {
    renderConfirmDialog({ description: 'This action cannot be undone.' })
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('shows default Cancel and Confirm button labels', () => {
    renderConfirmDialog()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('supports custom button labels', () => {
    renderConfirmDialog({ confirmLabel: 'Delete', cancelLabel: 'Go Back' })
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Go Back')).toBeInTheDocument()
  })

  it('calls onConfirm and onOpenChange(false) when confirm clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    renderConfirmDialog({ onConfirm, onOpenChange })

    await user.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when cancel clicked without calling onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    renderConfirmDialog({ onConfirm, onOpenChange })

    await user.click(screen.getByText('Cancel'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
