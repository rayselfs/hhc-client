import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { UsePdfReturn } from './usePdf'
import { useSentry } from './useSentry'

/**
 * Options for PDF renderer composable
 */
export interface UsePdfRendererOptions {
  /** The usePdf composable return value */
  pdfComposable: UsePdfReturn
  /** Container dimensions */
  containerWidth: Ref<number>
  containerHeight: Ref<number>
  /** Canvas refs */
  canvasRef: Ref<HTMLCanvasElement | null>
  scrollContainerRef: Ref<HTMLElement | null>
  pageCanvasRefs: Ref<Map<number, HTMLCanvasElement>>
  /** Props */
  zoom: Ref<number>
  pan: Ref<{ x: number; y: number }>
  /** Emit function */
  emit: (event: 'pageChange', page: number) => void
}

/**
 * Return value from PDF renderer composable
 */
export interface UsePdfRendererReturn {
  /** Computed canvas style for slide mode */
  canvasStyle: ComputedRef<Record<string, string>>
  /** Base width before zoom */
  baseWidth: Ref<number>
  /** Base height before zoom */
  baseHeight: Ref<number>
  /** Render current page in slide mode */
  renderCurrentPage: () => Promise<void>
  /** Render visible pages in scroll mode */
  renderVisiblePages: () => Promise<void>
  /** Scroll event handler */
  onScroll: () => void
  /** Clear rendered pages cache */
  clearRenderedPages: () => void
}

/**
 * Composable for PDF canvas rendering logic
 * Handles slide mode (single page with zoom/pan) and scroll mode (multi-page viewport)
 */
export function usePdfRenderer(options: UsePdfRendererOptions): UsePdfRendererReturn {
  const { reportError } = useSentry()

  // Rendering state
  const isRendering = ref(false)
  const pendingRender = ref<{ page: number; zoom: number } | null>(null)
  const baseWidth = ref(0)
  const baseHeight = ref(0)
  const renderedPages = ref<Set<number>>(new Set())

  /**
   * Computed canvas style with zoom and pan transforms
   */
  const canvasStyle = computed(() => {
    const zoomedWidth = baseWidth.value * options.zoom.value
    const zoomedHeight = baseHeight.value * options.zoom.value
    return {
      width: zoomedWidth > 0 ? `${zoomedWidth}px` : 'auto',
      height: zoomedHeight > 0 ? `${zoomedHeight}px` : 'auto',
      transform: `translate(${options.pan.value.x * 100}%, ${options.pan.value.y * 100}%)`,
      transformOrigin: 'center center',
      transition: 'transform 0.1s ease-out',
    }
  })

  /**
   * Calculate base size to fit page within container
   */
  const calculateBaseSize = async (): Promise<{ width: number; height: number }> => {
    const service = options.pdfComposable.getService()
    const dims = await service.getPageDimensions(options.pdfComposable.currentPage.value)
    if (!dims) return { width: 0, height: 0 }

    const scaleX = options.containerWidth.value / dims.width
    const scaleY = options.containerHeight.value / dims.height
    const scale = Math.min(scaleX, scaleY)

    return {
      width: dims.width * scale,
      height: dims.height * scale,
    }
  }

  /**
   * Render current page in slide mode
   */
  const renderCurrentPage = async () => {
    if (
      !options.canvasRef.value ||
      options.pdfComposable.isLoading.value ||
      options.pdfComposable.error.value
    )
      return
    if (options.containerWidth.value <= 0 || options.containerHeight.value <= 0) return

    if (isRendering.value) {
      pendingRender.value = {
        page: options.pdfComposable.currentPage.value,
        zoom: options.zoom.value,
      }
      return
    }

    isRendering.value = true

    try {
      const base = await calculateBaseSize()
      baseWidth.value = base.width
      baseHeight.value = base.height

      const dpr = window.devicePixelRatio || 1
      const effectiveZoom = options.zoom.value * dpr

      await options.pdfComposable.renderPage(options.canvasRef.value, {
        fitMode: 'page',
        containerWidth: base.width * effectiveZoom,
        containerHeight: base.height * effectiveZoom,
      })

      const zoomedWidth = base.width * options.zoom.value
      const zoomedHeight = base.height * options.zoom.value
      options.canvasRef.value.style.width = `${zoomedWidth}px`
      options.canvasRef.value.style.height = `${zoomedHeight}px`
    } catch (e) {
      reportError(e, {
        operation: 'render-page',
        component: 'PdfViewer',
        extra: {
          page: options.pdfComposable.currentPage.value,
          zoom: options.zoom.value,
        },
      })
    } finally {
      isRendering.value = false

      if (pendingRender.value !== null) {
        const pending = pendingRender.value
        pendingRender.value = null
        if (
          pending.page !== options.pdfComposable.currentPage.value ||
          pending.zoom !== options.zoom.value
        ) {
          options.pdfComposable.currentPage.value = pending.page
          await renderCurrentPage()
        }
      }
    }
  }

  /**
   * Render a single page in scroll mode
   */
  const renderScrollPage = async (page: number) => {
    const canvas = options.pageCanvasRefs.value.get(page)
    if (!canvas || renderedPages.value.has(page)) return

    try {
      const dpr = window.devicePixelRatio || 1
      await options.pdfComposable.renderPageNumber(canvas, page, {
        fitMode: 'width',
        containerWidth: options.containerWidth.value * dpr,
        containerHeight: options.containerHeight.value * dpr,
      })
      canvas.style.width = `${canvas.width / dpr}px`
      canvas.style.height = `${canvas.height / dpr}px`
      renderedPages.value.add(page)
    } catch (e) {
      if ((e as Error)?.name === 'RenderingCancelledException') return
      reportError(e, {
        operation: 'render-scroll-page',
        component: 'PdfViewer',
        extra: { page },
      })
    }
  }

  /**
   * Render visible pages in scroll mode with buffer
   */
  const renderVisiblePages = async () => {
    if (!options.scrollContainerRef.value || options.pdfComposable.viewMode.value !== 'scroll')
      return

    const container = options.scrollContainerRef.value
    const containerRect = container.getBoundingClientRect()

    const pageWrappers = container.querySelectorAll<HTMLElement>('.pdf-page-wrapper')
    const buffer = 2

    let firstVisible = -1
    let lastVisible = -1

    pageWrappers.forEach((wrapper, index) => {
      const wrapperRect = wrapper.getBoundingClientRect()
      const isVisible =
        wrapperRect.bottom > containerRect.top && wrapperRect.top < containerRect.bottom

      if (isVisible) {
        if (firstVisible === -1) firstVisible = index
        lastVisible = index
      }
    })

    if (firstVisible === -1) return

    const startPage = Math.max(1, firstVisible + 1 - buffer)
    const endPage = Math.min(options.pdfComposable.pageCount.value, lastVisible + 1 + buffer)

    for (let page = startPage; page <= endPage; page++) {
      await renderScrollPage(page)
    }

    const scrollTop = container.scrollTop
    const centerY = scrollTop + containerRect.height / 2
    let detectedPage = 1

    pageWrappers.forEach((wrapper, index) => {
      const wrapperTop = wrapper.offsetTop
      const wrapperHeight = wrapper.offsetHeight
      if (centerY >= wrapperTop && centerY < wrapperTop + wrapperHeight) {
        detectedPage = index + 1
      }
    })

    if (detectedPage !== options.pdfComposable.currentPage.value) {
      options.pdfComposable.currentPage.value = detectedPage
      options.emit('pageChange', detectedPage)
    }
  }

  /**
   * Scroll event handler
   */
  const onScroll = () => {
    renderVisiblePages()
  }

  /**
   * Clear rendered pages cache
   */
  const clearRenderedPages = () => {
    renderedPages.value.clear()
  }

  return {
    canvasStyle,
    baseWidth,
    baseHeight,
    renderCurrentPage,
    renderVisiblePages,
    onScroll,
    clearRenderedPages,
  }
}
