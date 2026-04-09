import '@testing-library/jest-dom/vitest'

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react')
  const {
    TabsMock,
    ModalMock,
    PopoverMock,
    useOverlayStateMock,
    AvatarMock,
    DropdownMock,
    SelectMock,
    ListboxMock
  } = await import('./heroui-mock')
  return {
    ...actual,
    Tabs: TabsMock,
    Modal: ModalMock,
    Popover: PopoverMock,
    useOverlayState: useOverlayStateMock,
    Avatar: AvatarMock,
    Dropdown: DropdownMock,
    Select: SelectMock,
    Listbox: ListboxMock,
    ListBox: ListboxMock
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
