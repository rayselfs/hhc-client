import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { BiblePassage } from '@shared/types/bible'
import { BibleSelectorDialog } from '../BibleSelectorDialog'

const mockGetCurrentChapter = vi.fn(() => ({
  number: 1,
  verses: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, number: i + 1, text: '' }))
}))

vi.mock('@renderer/stores/bible', () => ({
  useBibleStore: Object.assign(vi.fn(), {
    getState: () => ({
      getCurrentChapter: mockGetCurrentChapter
    })
  })
}))

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>()
  return {
    ...actual,
    Modal: Object.assign(
      ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div role="dialog">{children}</div> : null,
      {
        Backdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
      }
    ),
    Breadcrumbs: Object.assign(
      ({ children }: { children: React.ReactNode }) => (
        <nav aria-label="breadcrumbs">{children}</nav>
      ),
      {
        Item: ({
          children,
          onPress,
          isDisabled
        }: {
          children: React.ReactNode
          onPress?: () => void
          isDisabled?: boolean
        }) => (
          <button type="button" onClick={onPress} disabled={isDisabled}>
            {children}
          </button>
        )
      }
    ),
    ButtonGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Separator: () => <hr />
  }
})

function renderDialog(
  overrides: {
    isOpen?: boolean
    onOpenChange?: (v: boolean) => void
    onSelect?: (p: BiblePassage) => void
  } = {}
) {
  const props = {
    isOpen: true,
    onOpenChange: vi.fn(),
    onSelect: vi.fn(),
    ...overrides
  }
  return { ...render(<BibleSelectorDialog {...props} />), ...props }
}

describe('BibleSelectorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders book list on initial open', () => {
    renderDialog()
    expect(screen.getByRole('button', { name: '創世記' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '馬太福音' })).toBeInTheDocument()
  })

  it('shows Old and New Testament separators', () => {
    renderDialog()
    expect(screen.getByText('舊約')).toBeInTheDocument()
    expect(screen.getByText('新約')).toBeInTheDocument()
  })

  it('clicking a book navigates to chapter step', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: '創世記' }))
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
  })

  it('clicking a chapter navigates to verse step', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: '創世記' }))
    await user.click(screen.getByRole('button', { name: '1' }))
    const verseButtons = screen
      .getAllByRole('button')
      .filter((b) => /^\d+$/.test(b.textContent ?? ''))
    expect(verseButtons.length).toBeGreaterThan(0)
  })

  it('selecting a verse calls onSelect with correct passage', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderDialog({ onSelect })
    await user.click(screen.getByRole('button', { name: '創世記' }))
    await user.click(screen.getByRole('button', { name: '1' }))
    const dialog = document.querySelector('[role="dialog"]')!
    const verseButtons = Array.from(dialog.querySelectorAll('button')).filter(
      (b) => /^\d+$/.test(b.textContent ?? '') && !b.closest('nav')
    )
    await user.click(verseButtons[0])
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ bookNumber: 1, chapter: 1, verse: 1 })
    )
  })

  it('selecting a verse calls onOpenChange(false)', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderDialog({ onOpenChange })
    await user.click(screen.getByRole('button', { name: '創世記' }))
    await user.click(screen.getByRole('button', { name: '1' }))
    const dialog = document.querySelector('[role="dialog"]')!
    const verseButtons = Array.from(dialog.querySelectorAll('button')).filter(
      (b) => /^\d+$/.test(b.textContent ?? '') && !b.closest('nav')
    )
    await user.click(verseButtons[0])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('breadcrumb book button navigates back to book step', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: '創世記' }))
    await user.click(screen.getByRole('button', { name: '1' }))
    const breadcrumbNav = screen.getByRole('navigation', { name: 'breadcrumbs' })
    const breadcrumbButtons = breadcrumbNav.querySelectorAll('button')
    fireEvent.click(breadcrumbButtons[0])
    expect(screen.getAllByRole('button', { name: '創世記' }).length).toBeGreaterThanOrEqual(1)
  })

  it('does not render when closed', () => {
    renderDialog({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('books button in header navigates back to books step', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: '創世記' }))
    await user.click(screen.getByRole('button', { name: '書卷' }))
    expect(screen.getAllByRole('button', { name: '創世記' }).length).toBeGreaterThanOrEqual(1)
  })
})
