import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import * as Sentry from '@sentry/vue'

// Configure PDF.js worker
// In Vite/Electron, we use the worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfMetadata {
  pageCount: number
  title?: string
  author?: string
}

export interface RenderOptions {
  scale?: number
  fitMode?: 'page' | 'width'
  containerWidth?: number
  containerHeight?: number
}

export class PdfService {
  private document: PDFDocumentProxy | null = null
  private pageCache: Map<number, PDFPageProxy> = new Map()
  private url: string = ''
  // Track active render tasks per canvas to allow cancellation
  private activeRenderTasks: Map<HTMLCanvasElement, RenderTask> = new Map()

  /**
   * Load a PDF document from URL
   * @param url - The URL of the PDF file (can be file:// or http://)
   * @returns PDF metadata including page count
   */
  async loadDocument(url: string): Promise<PdfMetadata> {
    // Dispose previous document if any
    this.dispose()

    this.url = url

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      url,
      // Enable range requests for large files
      disableAutoFetch: false,
      disableStream: false,
      // Suppress non-critical font warnings (e.g., "TT: undefined function")
      verbosity: pdfjsLib.VerbosityLevel.ERRORS,
    })

    this.document = await loadingTask.promise

    // Extract metadata
    const metadata = await this.document.getMetadata().catch(() => null)
    const info = metadata?.info as Record<string, unknown> | undefined

    return {
      pageCount: this.document.numPages,
      title: info?.Title as string | undefined,
      author: info?.Author as string | undefined,
    }
  }

  /**
   * Get a page from the document (with caching)
   * @param pageNumber - Page number (1-indexed)
   */
  private async getPage(pageNumber: number): Promise<PDFPageProxy> {
    if (!this.document) {
      throw new Error('PDF document not loaded')
    }

    if (pageNumber < 1 || pageNumber > this.document.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}`)
    }

    // Check cache first
    const cached = this.pageCache.get(pageNumber)
    if (cached) {
      return cached
    }

    // Load and cache page
    const page = await this.document.getPage(pageNumber)
    this.pageCache.set(pageNumber, page)

    return page
  }

  /**
   * Calculate the scale factor based on fit mode
   */
  private calculateScale(page: PDFPageProxy, options: RenderOptions): number {
    const viewport = page.getViewport({ scale: 1 })

    if (options.scale) {
      return options.scale
    }

    if (!options.containerWidth || !options.containerHeight) {
      return 1
    }

    const fitMode = options.fitMode || 'page'

    if (fitMode === 'width') {
      return options.containerWidth / viewport.width
    }

    // fitMode === 'page'
    const scaleX = options.containerWidth / viewport.width
    const scaleY = options.containerHeight / viewport.height
    return Math.min(scaleX, scaleY)
  }

  /**
   * Cancel any active render task for a canvas
   * @param canvas - The canvas element
   */
  cancelRender(canvas: HTMLCanvasElement): void {
    const activeTask = this.activeRenderTasks.get(canvas)
    if (activeTask) {
      activeTask.cancel()
      this.activeRenderTasks.delete(canvas)
    }
  }

  /**
   * Render a page to a canvas element
   * @param canvas - The canvas element to render to
   * @param pageNumber - Page number (1-indexed)
   * @param options - Render options
   */
  async renderPage(
    canvas: HTMLCanvasElement,
    pageNumber: number,
    options: RenderOptions = {},
  ): Promise<void> {
    // Cancel any existing render on this canvas
    this.cancelRender(canvas)

    const page = await this.getPage(pageNumber)
    const scale = this.calculateScale(page, options)
    const viewport = page.getViewport({ scale })

    // Set canvas dimensions
    canvas.width = viewport.width
    canvas.height = viewport.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get canvas 2d context')
    }

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height)

    // Start render task and track it
    const renderTask = page.render({
      canvasContext: context,
      viewport,
      canvas,
    })
    this.activeRenderTasks.set(canvas, renderTask)

    try {
      await renderTask.promise
    } finally {
      // Clean up after render completes or is cancelled
      this.activeRenderTasks.delete(canvas)
    }
  }

  /**
   * Generate a thumbnail for a page
   * @param pageNumber - Page number (1-indexed)
   * @param width - Thumbnail width in pixels
   * @returns JPEG Blob or null if failed
   */
  async generateThumbnail(pageNumber: number = 1, width: number = 300): Promise<Blob | null> {
    if (!this.document) return null

    try {
      const page = await this.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const scale = width / viewport.width
      const scaledViewport = page.getViewport({ scale })

      // Create off-screen canvas
      const canvas = document.createElement('canvas')
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height

      const context = canvas.getContext('2d')
      if (!context) return null

      // White background for transparency
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
        canvas,
      }).promise

      // Convert to JPEG Blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8)
      })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'generate-pdf-thumbnail' },
        extra: { pageNumber, width },
      })
      return null
    }
  }

  /**
   * Get the total page count
   */
  getPageCount(): number {
    return this.document?.numPages ?? 0
  }

  /**
   * Get the current document URL
   */
  getUrl(): string {
    return this.url
  }

  /**
   * Check if a document is loaded
   */
  isLoaded(): boolean {
    return this.document !== null
  }

  /**
   * Get page dimensions at scale 1
   * @param pageNumber - Page number (1-indexed)
   * @returns Page dimensions or null
   */
  async getPageDimensions(pageNumber: number): Promise<{ width: number; height: number } | null> {
    try {
      const page = await this.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      return {
        width: viewport.width,
        height: viewport.height,
      }
    } catch {
      return null
    }
  }

  /**
   * Dispose the PDF document and free resources
   */
  dispose(): void {
    // Cancel all active render tasks
    for (const [canvas] of this.activeRenderTasks) {
      this.cancelRender(canvas)
    }
    this.activeRenderTasks.clear()

    if (this.document) {
      this.document.destroy()
      this.document = null
    }
    this.pageCache.clear()
    this.url = ''
  }
}
