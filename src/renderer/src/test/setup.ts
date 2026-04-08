import '@testing-library/jest-dom/vitest'

vi.mock('@heroui/react', async () => {
  const actual = await vi.importActual<typeof import('@heroui/react')>('@heroui/react')
  const { TabsMock, ModalMock, PopoverMock, useOverlayStateMock } = await import('./heroui-mock')
  return {
    ...actual,
    Tabs: TabsMock,
    Modal: ModalMock,
    Popover: PopoverMock,
    useOverlayState: useOverlayStateMock
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
