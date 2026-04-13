import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { BiblePassage } from '@shared/types/bible'
import { BibleSelectorDialog } from '../BibleSelectorDialog'

vi.mock('@renderer/stores/bible', () => ({
  useBibleStore: Object.assign(vi.fn(), {
    getState: () => ({
      content: new Map([
        [
          1,
          [
            {
              number: 1,
              chapters: [
                {
                  number: 1,
                  verses: Array.from({ length: 30 }, (_, i) => ({
                    id: i + 1,
                    number: i + 1,
                    text: ''
                  }))
                }
              ]
            }
          ]
        ]
      ])
    })
  })
}))

vi.mock('@renderer/stores/bible-settings', () => ({
  useBibleSettingsStore: Object.assign(vi.fn(), {
    getState: () => ({ selectedVersionId: 1 })
  })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'bible.selector.title': 'Select Passage',
        'bible.selector.bookAbbr': 'B',
        'bible.selector.chapterAbbr': 'C',
        'bible.selector.verseAbbr': 'V',
        'bible.books.gen.name': '創世記',
        'bible.books.mat.name': '馬太福音'
      }
      return map[key] ?? key
    }
  })
}))

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>()
  return {
    ...actual,
    ScrollShadow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Modal: Object.assign(vi.fn(), {
      Backdrop: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div role="dialog">{children}</div> : null,
      Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CloseTrigger: () => null
    }),
    Tabs: Object.assign(
      ({
        children,
        onSelectionChange
      }: {
        children: React.ReactNode
        onSelectionChange?: (key: string) => void
      }) => (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          role="none"
          onClick={(e) => {
            const btn = (e.target as HTMLElement).closest('[data-tab-id]')
            if (btn && onSelectionChange) {
              onSelectionChange(btn.getAttribute('data-tab-id') ?? '')
            }
          }}
        >
          {children}
        </div>
      ),
      {
        ListContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        List: ({ children }: { children: React.ReactNode }) => <div role="tablist">{children}</div>,
        Tab: ({
          id,
          children,
          isDisabled
        }: {
          id: string
          children: React.ReactNode
          isDisabled?: boolean
        }) => (
          <button type="button" role="tab" data-tab-id={id} disabled={isDisabled}>
            {children}
          </button>
        ),
        Indicator: () => null,
        Panel: ({ children }: { children: React.ReactNode }) => (
          <div role="tabpanel">{children}</div>
        )
      }
    ),
    Breadcrumbs: Object.assign(
      ({ children }: { children: React.ReactNode }) => <nav>{children}</nav>,
      {
        Item: ({ children, isDisabled }: { children: React.ReactNode; isDisabled?: boolean }) => (
          <span aria-disabled={isDisabled}>{children}</span>
        )
      }
    )
  }
})

function renderDialog(
  overrides: {
    isOpen?: boolean
    onOpenChange?: (v: boolean) => void
    onSelect?: (p: BiblePassage) => void
  } = {}
): ReturnType<typeof render> & Record<string, unknown> {
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

  it('shows a GlassDivider between OT and NT books', () => {
    renderDialog()
    expect(screen.getByRole('separator')).toBeInTheDocument()
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

  it('breadcrumb shows selected book name after book selection', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: '創世記' }))
    const nav = document.querySelector('nav')!
    expect(nav.textContent).toContain('創世記')
  })

  it('does not render when closed', () => {
    renderDialog({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('books tab in header navigates back to books step', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('button', { name: '創世記' }))
    await user.click(screen.getByRole('tab', { name: 'B' }))
    expect(screen.getAllByRole('button', { name: '創世記' }).length).toBeGreaterThanOrEqual(1)
  })
})
