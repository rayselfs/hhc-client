import { render, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import PdfPreview from '../PdfPreview'

const { getPageMock, mockGetFileSource } = vi.hoisted(() => {
  const getPageMock = vi.fn().mockResolvedValue({
    getViewport: vi.fn().mockReturnValue({ width: 100, height: 140 }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve() })
  })
  return { getPageMock, mockGetFileSource: vi.fn() }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn().mockResolvedValue({}),
  getFileSource: mockGetFileSource
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { warning: vi.fn() }
}))

vi.mock('@renderer/contexts/PresenterCommandContext', () => ({
  usePresenterCommands: () => ({ sendCommand: vi.fn() })
}))

vi.mock('@renderer/lib/pdfjs-loader', () => ({
  loadPdfjsLib: vi.fn().mockResolvedValue({
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 20,
        getPage: getPageMock,
        destroy: vi.fn()
      })
    })
  })
}))

const mockStoreState = {
  typeStates: { pdf: { viewMode: 'scroll' as const } },
  zoomLevel: 1,
  pan: { x: 0, y: 0 },
  canNext: vi.fn().mockReturnValue(false),
  next: vi.fn(),
  exit: vi.fn(),
  getState: vi.fn()
}

vi.mock('@renderer/stores/media-projection', () => ({
  useMediaProjectionStore: Object.assign(
    vi.fn((selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState)),
    { getState: () => mockStoreState }
  )
}))

type IOCallback = (entries: IntersectionObserverEntry[]) => void

let capturedIOCallback: IOCallback | null = null
let capturedObservedElements: Element[] = []

function setupIntersectionObserverMock(): void {
  capturedIOCallback = null
  capturedObservedElements = []

  class MockIntersectionObserver {
    constructor(callback: IOCallback) {
      capturedIOCallback = callback
    }
    observe(el: Element): void {
      capturedObservedElements.push(el)
    }
    unobserve = vi.fn()
    disconnect = vi.fn()
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
}

function makeItem(overrides: Partial<FileItemRecord> = {}): FileItemRecord {
  return {
    id: 'pdf-item-1',
    parentId: 'folder-1',
    type: 'file',
    sortIndex: 0,
    createdAt: Date.now(),
    expiresAt: null,
    name: 'test.pdf',
    url: 'blob:original-pdf-id',
    size: 5000,
    mimeType: 'application/pdf',
    ...overrides
  }
}

describe('PdfPreview scroll mode lazy rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFileSource.mockResolvedValue({
      url: 'blob:fake-pdf',
      revoke: vi.fn()
    })
    setupIntersectionObserverMock()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders only page 1 on initial mount for a 20-page PDF in scroll mode', async () => {
    const item = makeItem()
    render(<PdfPreview item={item} />)

    await waitFor(() => {
      expect(getPageMock).toHaveBeenCalled()
    })

    expect(getPageMock).toHaveBeenCalledTimes(1)
    expect(getPageMock).toHaveBeenCalledWith(1)
    expect(mockGetFileSource).toHaveBeenCalledWith({}, 'original-pdf-id', 'application/pdf')
  })

  it('renders page 2 when IntersectionObserver fires for canvas with data-page-index=1', async () => {
    const item = makeItem()
    render(<PdfPreview item={item} />)

    await waitFor(() => {
      expect(getPageMock).toHaveBeenCalledTimes(1)
    })

    expect(capturedIOCallback).not.toBeNull()

    const fakeCanvas = document.createElement('canvas')
    fakeCanvas.dataset.pageIndex = '1'

    capturedIOCallback!([
      {
        isIntersecting: true,
        target: fakeCanvas
      } as unknown as IntersectionObserverEntry
    ])

    await waitFor(() => {
      expect(getPageMock).toHaveBeenCalledTimes(2)
    })

    expect(getPageMock).toHaveBeenNthCalledWith(2, 2)
  })

  it('does not double-render a page already rendered (page index 0)', async () => {
    const item = makeItem()
    render(<PdfPreview item={item} />)

    await waitFor(() => {
      expect(getPageMock).toHaveBeenCalledTimes(1)
    })

    const fakeCanvas = document.createElement('canvas')
    fakeCanvas.dataset.pageIndex = '0'

    capturedIOCallback!([
      {
        isIntersecting: true,
        target: fakeCanvas
      } as unknown as IntersectionObserverEntry
    ])

    await new Promise((r) => setTimeout(r, 50))

    expect(getPageMock).toHaveBeenCalledTimes(1)
  })
})
