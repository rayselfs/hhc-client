import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import '@renderer/i18n'
import { ConfirmDialogProvider, useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import type { ConfirmOptions } from '@renderer/contexts/ConfirmDialogContext'
import ConfirmDialog from '../ConfirmDialog'

function TestHarness({
  onResult,
  onConfirmRef
}: {
  onResult: (confirmed: boolean) => void
  onConfirmRef?: (confirm: (options: ConfirmOptions) => Promise<boolean>) => void
}): React.JSX.Element {
  const confirm = useConfirm()
  if (onConfirmRef) {
    onConfirmRef(confirm)
  }
  return (
    <button
      type="button"
      onClick={() => {
        confirm({ description: 'Are you sure?' }).then(onResult)
      }}
    >
      Open
    </button>
  )
}

function renderWithProvider(
  onResult: (confirmed: boolean) => void,
  onConfirmRef?: (confirm: (options: ConfirmOptions) => Promise<boolean>) => void
): ReturnType<typeof render> {
  return render(
    <ConfirmDialogProvider>
      <TestHarness onResult={onResult} onConfirmRef={onConfirmRef} />
      <ConfirmDialog />
    </ConfirmDialogProvider>
  )
}

describe('ConfirmDialog', () => {
  it('renders when confirm() is called', async () => {
    const user = userEvent.setup()
    renderWithProvider(() => {})
    await user.click(screen.getByText('Open'))
    expect(await screen.findByText('Warning')).toBeInTheDocument()
    expect(await screen.findByText('Are you sure?')).toBeInTheDocument()
  })

  it('does not render before confirm() is called', () => {
    renderWithProvider(() => {})
    expect(screen.queryByText('Warning')).not.toBeInTheDocument()
  })

  it('shows default Cancel and Confirm button labels', async () => {
    const user = userEvent.setup()
    renderWithProvider(() => {})
    await user.click(screen.getByText('Open'))
    expect(await screen.findByText('Cancel')).toBeInTheDocument()
    expect(await screen.findByText('Confirm')).toBeInTheDocument()
  })

  it('resolves true and closes when Confirm is clicked', async () => {
    const user = userEvent.setup()
    let result: boolean | undefined
    renderWithProvider((v) => {
      result = v
    })
    await user.click(screen.getByText('Open'))
    await act(async () => {
      await user.click(await screen.findByText('Confirm'))
    })
    expect(result).toBe(true)
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
  })

  it('resolves false and closes when Cancel is clicked', async () => {
    const user = userEvent.setup()
    let result: boolean | undefined
    renderWithProvider((v) => {
      result = v
    })
    await user.click(screen.getByText('Open'))
    await act(async () => {
      await user.click(await screen.findByText('Cancel'))
    })
    expect(result).toBe(false)
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
  })

  it('maintains stable confirm reference across re-renders', () => {
    let confirmRef1: ((options: ConfirmOptions) => Promise<boolean>) | undefined
    let confirmRef2: ((options: ConfirmOptions) => Promise<boolean>) | undefined
    const { rerender } = renderWithProvider(
      () => {},
      (confirm) => {
        confirmRef1 = confirm
      }
    )
    // Force a re-render by changing a prop on the provider
    rerender(
      <ConfirmDialogProvider>
        <TestHarness
          onResult={() => {}}
          onConfirmRef={(confirm) => {
            confirmRef2 = confirm
          }}
        />
        <ConfirmDialog />
      </ConfirmDialogProvider>
    )
    // Assert that confirm function reference is stable
    expect(confirmRef2).toBe(confirmRef1)
  })
})
