import { ref, onUnmounted, type Ref } from 'vue'
import { PdfService, type PdfMetadata, type RenderOptions } from '@/services/pdf'
import { useSentry } from '@/composables/useSentry'

export type PdfViewMode = 'slide' | 'scroll'

export interface UsePdfOptions {
  /** Initial view mode */
  viewMode?: PdfViewMode
}

export interface UsePdfReturn {
  // State
  pageCount: Ref<number>
  currentPage: Ref<number>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  viewMode: Ref<PdfViewMode>
  metadata: Ref<PdfMetadata | null>

  // Methods
  loadPdf: (url: string) => Promise<boolean>
  renderPage: (canvas: HTMLCanvasElement, options?: RenderOptions) => Promise<void>
  renderPageNumber: (
    canvas: HTMLCanvasElement,
    pageNumber: number,
    options?: RenderOptions,
  ) => Promise<void>
  nextPage: () => void
  prevPage: () => void
  goToPage: (page: number) => void
  generateThumbnail: (pageNumber?: number, width?: number) => Promise<Blob | null>
  dispose: () => void
  getService: () => PdfService
}

/**
 * Vue composable for PDF viewing functionality
 * Wraps PdfService with reactive state management
 */
export function usePdf(options: UsePdfOptions = {}): UsePdfReturn {
  const pdfService = new PdfService()
  const { reportError } = useSentry()

  // Reactive state
  const pageCount = ref(0)
  const currentPage = ref(1)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const viewMode = ref<PdfViewMode>(options.viewMode ?? 'slide')
  const metadata = ref<PdfMetadata | null>(null)

  /**
   * Load a PDF document
   * @param url - The URL of the PDF file
   * @returns true if successful, false otherwise
   */
  const loadPdf = async (url: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const meta = await pdfService.loadDocument(url)
      pageCount.value = meta.pageCount
      metadata.value = meta
      currentPage.value = 1
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load PDF'
      reportError(e, {
        operation: 'load-pdf',
        component: 'usePdf',
        extra: { url },
      })
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Render the current page to a canvas
   * @param canvas - The canvas element to render to
   * @param options - Render options
   */
  const renderPage = async (canvas: HTMLCanvasElement, options?: RenderOptions): Promise<void> => {
    if (!pdfService.isLoaded()) {
      throw new Error('PDF not loaded')
    }

    await pdfService.renderPage(canvas, currentPage.value, options)
  }

  /**
   * Render a specific page to a canvas
   * @param canvas - The canvas element to render to
   * @param pageNumber - The page number to render (1-indexed)
   * @param options - Render options
   */
  const renderPageNumber = async (
    canvas: HTMLCanvasElement,
    pageNumber: number,
    options?: RenderOptions,
  ): Promise<void> => {
    if (!pdfService.isLoaded()) {
      throw new Error('PDF not loaded')
    }

    await pdfService.renderPage(canvas, pageNumber, options)
  }

  /**
   * Navigate to the next page
   */
  const nextPage = (): void => {
    if (currentPage.value < pageCount.value) {
      currentPage.value++
    }
  }

  /**
   * Navigate to the previous page
   */
  const prevPage = (): void => {
    if (currentPage.value > 1) {
      currentPage.value--
    }
  }

  /**
   * Navigate to a specific page
   * @param page - The page number (1-indexed, clamped to valid range)
   */
  const goToPage = (page: number): void => {
    currentPage.value = Math.max(1, Math.min(page, pageCount.value))
  }

  /**
   * Generate a thumbnail for a page
   * @param pageNumber - Page number (defaults to current page)
   * @param width - Thumbnail width (defaults to 300)
   */
  const generateThumbnail = async (
    pageNumber: number = currentPage.value,
    width: number = 300,
  ): Promise<Blob | null> => {
    return pdfService.generateThumbnail(pageNumber, width)
  }

  /**
   * Dispose the PDF service and free resources
   */
  const dispose = (): void => {
    pdfService.dispose()
    pageCount.value = 0
    currentPage.value = 1
    metadata.value = null
    error.value = null
  }

  /**
   * Get the underlying PdfService instance
   * Useful for advanced operations
   */
  const getService = (): PdfService => pdfService

  // Auto-cleanup on unmount
  onUnmounted(() => {
    dispose()
  })

  return {
    // State
    pageCount,
    currentPage,
    isLoading,
    error,
    viewMode,
    metadata,

    // Methods
    loadPdf,
    renderPage,
    renderPageNumber,
    nextPage,
    prevPage,
    goToPage,
    generateThumbnail,
    dispose,
    getService,
  }
}
