import React from 'react'

// Module-level variables capture Tabs props during parent render so child Tab renders can read them
let capturedOnSelectionChange: ((key: string) => void) | undefined
let capturedSelectedKey: string | undefined

const TabsMock = Object.assign(
  ({
    children,
    selectedKey,
    onSelectionChange
  }: {
    children: React.ReactNode
    selectedKey?: string
    onSelectionChange?: (key: string) => void
  }) => {
    capturedOnSelectionChange = onSelectionChange
    capturedSelectedKey = selectedKey
    return <div role="tablist">{children}</div>
  },
  {
    Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ListContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    List: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Tab: ({
      children,
      id,
      'data-testid': dataTestId,
      ...rest
    }: {
      children: React.ReactNode
      id?: string
      'data-testid'?: string
      [key: string]: unknown
    }) => (
      <button
        role="tab"
        aria-selected={capturedSelectedKey === id}
        data-testid={dataTestId}
        onClick={() => id && capturedOnSelectionChange?.(id)}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    ),
    Indicator: () => null,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Separator: () => null
  }
)

const ModalMock = Object.assign(
  ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  {
    Root: ({ state, children }: { state?: { isOpen: boolean }; children: React.ReactNode }) =>
      state?.isOpen ? <div>{children}</div> : null,
    Trigger: () => null,
    Backdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Heading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Icon: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    CloseTrigger: () => null
  }
)

function useOverlayStateMock(args?: { isOpen?: boolean; onOpenChange?: (open: boolean) => void }): {
  isOpen: boolean
  setOpen: (v: boolean) => void
  open: () => void
  close: () => void
  toggle: () => void
} {
  return {
    isOpen: args?.isOpen ?? false,
    setOpen: (v: boolean) => args?.onOpenChange?.(v),
    open: () => args?.onOpenChange?.(true),
    close: () => args?.onOpenChange?.(false),
    toggle: () => args?.onOpenChange?.(!args?.isOpen)
  }
}

export { TabsMock, ModalMock, useOverlayStateMock }
