import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InlineRenameInput } from '../InlineRenameInput'

describe('InlineRenameInput', () => {
  it('submits with Enter', () => {
    const onSubmit = vi.fn()
    render(
      <InlineRenameInput
        initialValue="slides"
        ariaLabel="Rename file"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Rename file'), { target: { value: 'sermon' } })
    fireEvent.keyDown(screen.getByLabelText('Rename file'), { key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledWith('sermon')
  })

  it('does not submit Enter during IME composition', () => {
    const onSubmit = vi.fn()
    const input = render(
      <InlineRenameInput
        initialValue="講道"
        ariaLabel="Rename file"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    ).getByLabelText('Rename file')

    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('講道')
  })

  it('cancels with Escape and submits once on blur', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    const input = render(
      <InlineRenameInput
        initialValue="slides"
        ariaLabel="Rename file"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    ).getByLabelText('Rename file')

    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
