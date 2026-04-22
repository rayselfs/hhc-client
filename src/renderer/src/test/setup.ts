import '@testing-library/jest-dom/vitest'

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react')
  const {
    TabsMock,
    ModalMock,
    PopoverMock,
    AvatarMock,
    DropdownMock,
    SelectMock,
    ListboxMock,
    AlertDialogMock
  } = await import('./heroui-mock')
  return {
    ...actual,
    Tabs: TabsMock,
    Modal: ModalMock,
    AlertDialog: AlertDialogMock,
    Popover: PopoverMock,
    Avatar: AvatarMock,
    Dropdown: DropdownMock,
    Select: SelectMock,
    Listbox: ListboxMock,
    ListBox: ListboxMock
  }
})

vi.mock('@heroui/react/tabs', async () => {
  const { TabsMock } = await import('./heroui-mock')
  return { Tabs: TabsMock }
})

vi.mock('@heroui/react/modal', async () => {
  const { ModalMock } = await import('./heroui-mock')
  return { Modal: ModalMock }
})

vi.mock('@heroui/react/alert-dialog', async () => {
  const { AlertDialogMock } = await import('./heroui-mock')
  return { AlertDialog: AlertDialogMock }
})

vi.mock('@heroui/react/popover', async () => {
  const { PopoverMock } = await import('./heroui-mock')
  return { Popover: PopoverMock }
})

vi.mock('@heroui/react/avatar', async () => {
  const { AvatarMock } = await import('./heroui-mock')
  return { Avatar: AvatarMock }
})

vi.mock('@heroui/react/dropdown', async () => {
  const { DropdownMock } = await import('./heroui-mock')
  return { Dropdown: DropdownMock }
})

vi.mock('@heroui/react/select', async () => {
  const { SelectMock } = await import('./heroui-mock')
  return { Select: SelectMock }
})

vi.mock('@heroui/react/list-box', async () => {
  const { ListboxMock } = await import('./heroui-mock')
  return { ListBox: ListboxMock }
})

vi.mock('react-aria-components', async () => {
  const React = await import('react')
  const actual =
    await vi.importActual<typeof import('react-aria-components')>('react-aria-components')
  return {
    ...actual,
    Label: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement('label', props, children)
  }
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
})

globalThis.ResizeObserver = class {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
