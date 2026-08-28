import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../pdfjs-loader', () => ({
  loadPdfjsLib: vi.fn()
}))

vi.mock('../pptx-renderer-service', () => ({
  generatePptxFirstSlideThumbnail: vi.fn()
}))

import { generateAllPdfPageThumbnails, generateThumbnail } from '../thumbnail-generator'
import { loadPdfjsLib } from '../pdfjs-loader'
import { generatePptxFirstSlideThumbnail } from '../pptx-renderer-service'

const mockLoadPdfjsLib = vi.mocked(loadPdfjsLib)
const mockGeneratePptxFirstSlideThumbnail = vi.mocked(generatePptxFirstSlideThumbnail)

function makeFile(name: string, size: number, type: string): File {
  const file = new File([], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('T2 — PDF size guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not load PDF.js during module initialization', () => {
    expect(mockLoadPdfjsLib).not.toHaveBeenCalled()
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
      loadingTask: { destroy: vi.fn().mockResolvedValue(undefined) }
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

  it('yields before serializing an image canvas', async () => {
    const imageFile = makeFile('test.jpg', 1024, 'image/jpeg')
    const schedulerYield = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('scheduler', { yield: schedulerYield })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn()
    })

    let storedOnload: (() => void) | undefined
    function MockImage(this: { naturalWidth: number; naturalHeight: number }): void {
      this.naturalWidth = 200
      this.naturalHeight = 150
      Object.defineProperty(this, 'onload', {
        get() {
          return storedOnload
        },
        set(fn: () => void) {
          storedOnload = fn
        }
      })
      Object.defineProperty(this, 'src', {
        set() {
          storedOnload?.()
        }
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
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
      return document.createElement.call(document, tag)
    })

    await generateThumbnail(imageFile)

    expect(schedulerYield.mock.invocationCallOrder[0]).toBeLessThan(
      mockCanvas.toDataURL.mock.invocationCallOrder[0]
    )
    createElement.mockRestore()
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
        get() {
          return storedOnload
        },
        set(fn: () => void) {
          storedOnload = fn
        }
      })
      Object.defineProperty(this, 'src', {
        set(_val: string) {
          storedOnload?.()
        }
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

describe('PDF thumbnail yield ordering', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('yields before serializing a single PDF thumbnail', async () => {
    const events: string[] = []
    vi.stubGlobal('scheduler', { yield: vi.fn().mockImplementation(async () => events.push('yield')) })
    const page = {
      getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() })
    }
    const pdf = {
      getPage: vi.fn().mockResolvedValue(page),
      loadingTask: { destroy: vi.fn().mockResolvedValue(undefined) }
    }
    mockLoadPdfjsLib.mockResolvedValue({
      getDocument: vi.fn().mockReturnValue({ promise: Promise.resolve(pdf) })
    } as never)
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'canvas') return originalCreateElement(tag)
      return {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          clearRect: vi.fn()
        }),
        toDataURL: vi.fn().mockImplementation(() => {
          events.push('serialize')
          return 'data:image/jpeg;base64,pdf'
        })
      } as unknown as HTMLCanvasElement
    })

    await generateThumbnail(makeFile('single.pdf', 1024, 'application/pdf'))

    expect(events).toEqual(['yield', 'serialize'])
  })

  it('yields before and after serializing every PDF page', async () => {
    const events: string[] = []
    vi.stubGlobal('scheduler', { yield: vi.fn().mockImplementation(async () => events.push('yield')) })
    const pages = Array.from({ length: 2 }, () => ({
      getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() })
    }))
    const pdf = {
      numPages: 2,
      getPage: vi.fn((pageNumber: number) => Promise.resolve(pages[pageNumber - 1])),
      loadingTask: { destroy: vi.fn().mockResolvedValue(undefined) }
    }
    mockLoadPdfjsLib.mockResolvedValue({
      getDocument: vi.fn().mockReturnValue({ promise: Promise.resolve(pdf) })
    } as never)
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'canvas') return originalCreateElement(tag)
      return {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
          clearRect: vi.fn()
        }),
        toDataURL: vi.fn().mockImplementation(() => {
          events.push('serialize')
          return 'data:image/jpeg;base64,pdf'
        })
      } as unknown as HTMLCanvasElement
    })

    await generateAllPdfPageThumbnails(makeFile('pages.pdf', 1024, 'application/pdf'))

    expect(events).toEqual(['yield', 'serialize', 'yield', 'yield', 'serialize', 'yield'])
  })
})

describe('PPTX thumbnail generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates PPTX thumbnails to the browser-native renderer service', async () => {
    const pptxFile = makeFile(
      'sermon.pptx',
      4096,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
    mockGeneratePptxFirstSlideThumbnail.mockResolvedValue('data:image/jpeg;base64,pptx')

    const result = await generateThumbnail(
      pptxFile,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )

    expect(result).toBe('data:image/jpeg;base64,pptx')
    expect(mockGeneratePptxFirstSlideThumbnail).toHaveBeenCalledWith(pptxFile)
  })

  it('falls back silently when PPTX thumbnail canvas is tainted', async () => {
    const pptxFile = makeFile(
      'sermon.pptx',
      4096,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockGeneratePptxFirstSlideThumbnail.mockRejectedValue(
      Object.assign(new Error('tainted'), { name: 'SecurityError' })
    )

    const result = await generateThumbnail(
      pptxFile,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )

    expect(result).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
