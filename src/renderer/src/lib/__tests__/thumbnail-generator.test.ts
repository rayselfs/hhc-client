import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../pdfjs-loader', () => ({
  loadPdfjsLib: vi.fn()
}))

import { generateThumbnail } from '../thumbnail-generator'
import { loadPdfjsLib } from '../pdfjs-loader'

const mockLoadPdfjsLib = vi.mocked(loadPdfjsLib)

function makeFile(name: string, size: number, type: string): File {
  const file = new File([], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('T2 — PDF size guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for PDF > 50MB without calling loadPdfjsLib', async () => {
    const bigPdf = makeFile('big.pdf', 100 * 1024 * 1024, 'application/pdf')
    const arrayBufferSpy = vi.spyOn(bigPdf, 'arrayBuffer')

    const result = await generateThumbnail(bigPdf)

    expect(result).toBeNull()
    expect(mockLoadPdfjsLib).not.toHaveBeenCalled()
    expect(arrayBufferSpy).not.toHaveBeenCalled()
  })

  it('calls loadPdfjsLib for PDF <= 50MB', async () => {
    const smallPdf = makeFile('small.pdf', 5 * 1024 * 1024, 'application/pdf')

    const mockPage = {
      getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() })
    }
    const mockPdf = {
      getPage: vi.fn().mockResolvedValue(mockPage),
      destroy: vi.fn().mockResolvedValue(undefined)
    }
    mockLoadPdfjsLib.mockResolvedValue({
      getDocument: vi.fn().mockReturnValue({ promise: Promise.resolve(mockPdf) })
    } as never)

    const mockContext = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn()
    }
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,abc')
    }
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
      return document.createElement(tag)
    })

    await generateThumbnail(smallPdf)

    expect(mockLoadPdfjsLib).toHaveBeenCalledOnce()
  })
})

describe('T5 — generateImageThumbnail yield', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns a dataUrl string for a valid image file', async () => {
    const imageFile = makeFile('test.jpg', 1024, 'image/jpeg')

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn()
    })

    let storedOnload: (() => void) | undefined
    function MockImage(this: { naturalWidth: number; naturalHeight: number }): void {
      this.naturalWidth = 200
      this.naturalHeight = 150
      Object.defineProperty(this, 'onload', {
        get() { return storedOnload },
        set(fn: () => void) { storedOnload = fn }
      })
      Object.defineProperty(this, 'src', {
        set(_val: string) { storedOnload?.() }
      })
    }
    vi.stubGlobal('Image', MockImage)

    const mockContext = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn()
    }
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,xyz')
    }
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
      return document.createElement.call(document, tag)
    })

    const resultPromise = generateThumbnail(imageFile)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(typeof result).toBe('string')
    expect(result).toMatch(/^data:/)
  })
})
