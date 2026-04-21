import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@renderer/i18n'
import AboutDialog from '@renderer/components/Control/UserMenu/AboutDialog'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>()
  return {
    ...actual,
    useOverlayState: ({ isOpen }: { isOpen: boolean }) => ({
      isOpen,
      open: vi.fn(),
      close: vi.fn()
    }),
    Modal: Object.assign(actual.Modal, {
      Root: ({ state, children }: { state: { isOpen: boolean }; children: React.ReactNode }) =>
        state.isOpen ? <div role="dialog">{children}</div> : null,
      Trigger: () => null,
      Backdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    })
  }
})

const Wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <ShortcutScopeProvider>
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
  </ShortcutScopeProvider>
)

describe('AboutDialog', () => {
  it('renders app icon, name, version, and description when open', () => {
    render(<AboutDialog isOpen={true} onOpenChange={() => {}} />, { wrapper: Wrapper })

    const img = screen.getByAltText('HHC Client')
    expect(img).toBeInTheDocument()
    expect(img.tagName).toBe('IMG')

    expect(screen.getByText('HHC Client')).toBeInTheDocument()
    expect(screen.getByText(/^v/)).toBeInTheDocument()
    expect(screen.getByText('Church projection software for worship services.')).toBeInTheDocument()
  })

  it('does not render when isOpen=false', () => {
    const { container } = render(<AboutDialog isOpen={false} onOpenChange={() => {}} />, {
      wrapper: Wrapper
    })

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('displays icon to the left of text content', () => {
    render(<AboutDialog isOpen={true} onOpenChange={() => {}} />, { wrapper: Wrapper })

    const img = screen.getByAltText('HHC Client')
    const container = img.parentElement!
    expect(container.classList.contains('flex')).toBe(true)
    expect(container.classList.contains('flex-col')).toBe(false)
  })
})
