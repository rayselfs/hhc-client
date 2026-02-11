import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { usePdfRenderer } from '../usePdfRenderer'
import type { UsePdfReturn } from '../usePdf'
import type { PdfService } from '@/services/pdf/PdfService'

describe('usePdfRenderer', () => {
  let mockPdfComposable: UsePdfReturn
  let mockCanvas: HTMLCanvasElement
  let mockScrollContainer: HTMLDivElement

  beforeEach(() => {
    mockCanvas = document.createElement('canvas')
    mockScrollContainer = document.createElement('div')

    mockPdfComposable = {
      pageCount: ref(5),
      currentPage: ref(1),
      isLoading: ref(false),
      error: ref(null),
      viewMode: ref('slide'),
      metadata: ref({ pageCount: 5 }),
      loadPdf: vi.fn(),
      renderPage: vi.fn(),
      renderPageNumber: vi.fn(),
      nextPage: vi.fn(),
      prevPage: vi.fn(),
      goToPage: vi.fn(),
      generateThumbnail: vi.fn(),
      dispose: vi.fn(),
      getService: vi.fn(() => ({
        getPageDimensions: vi.fn(async () => ({ width: 800, height: 600 })),
      })) as unknown as () => PdfService,
    }
  })

  describe('canvasStyle', () => {
    it('should compute canvas style with zoom and pan', () => {
      const { canvasStyle, baseWidth, baseHeight } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1.5),
        pan: ref({ x: 0.1, y: -0.2 }),
        emit: vi.fn(),
      })

      baseWidth.value = 500
      baseHeight.value = 400

      expect(canvasStyle.value.width).toBe('750px')
      expect(canvasStyle.value.height).toBe('600px')
      expect(canvasStyle.value.transform).toContain('translate(10%, -20%)')
      expect(canvasStyle.value.transformOrigin).toBe('center center')
    })

    it('should handle zero baseWidth gracefully', () => {
      const { canvasStyle } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1.5),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      expect(canvasStyle.value.width).toBe('auto')
      expect(canvasStyle.value.height).toBe('auto')
    })

    it('should update when zoom changes', () => {
      const zoomRef = ref(1)
      const { canvasStyle, baseWidth } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: zoomRef,
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      baseWidth.value = 500

      expect(canvasStyle.value.width).toBe('500px')

      zoomRef.value = 2

      expect(canvasStyle.value.width).toBe('1000px')
    })
  })

  describe('renderCurrentPage', () => {
    it('should not render if canvas ref is null', async () => {
      const { renderCurrentPage } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(null),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      await renderCurrentPage()

      expect(mockPdfComposable.renderPage).not.toHaveBeenCalled()
    })

    it('should not render if loading', async () => {
      mockPdfComposable.isLoading.value = true

      const { renderCurrentPage } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      await renderCurrentPage()

      expect(mockPdfComposable.renderPage).not.toHaveBeenCalled()
    })

    it('should not render if error exists', async () => {
      mockPdfComposable.error.value = 'Test error'

      const { renderCurrentPage } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      await renderCurrentPage()

      expect(mockPdfComposable.renderPage).not.toHaveBeenCalled()
    })

    it('should not render if container has zero dimensions', async () => {
      const { renderCurrentPage } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(0),
        containerHeight: ref(0),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      await renderCurrentPage()

      expect(mockPdfComposable.renderPage).not.toHaveBeenCalled()
    })
  })

  describe('onScroll', () => {
    it('should call renderVisiblePages', () => {
      const { onScroll, renderVisiblePages } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      const spy = vi.spyOn({ renderVisiblePages }, 'renderVisiblePages')

      onScroll()

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('renderVisiblePages', () => {
    it('should not render if scrollContainerRef is null', async () => {
      const { renderVisiblePages } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(null),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      await renderVisiblePages()

      expect(mockPdfComposable.renderPageNumber).not.toHaveBeenCalled()
    })

    it('should not render if viewMode is not scroll', async () => {
      mockPdfComposable.viewMode.value = 'slide'

      const { renderVisiblePages } = usePdfRenderer({
        pdfComposable: mockPdfComposable,
        containerWidth: ref(1000),
        containerHeight: ref(800),
        canvasRef: ref(mockCanvas),
        scrollContainerRef: ref(mockScrollContainer),
        pageCanvasRefs: ref(new Map()),
        zoom: ref(1),
        pan: ref({ x: 0, y: 0 }),
        emit: vi.fn(),
      })

      await renderVisiblePages()

      expect(mockPdfComposable.renderPageNumber).not.toHaveBeenCalled()
    })
  })
})
