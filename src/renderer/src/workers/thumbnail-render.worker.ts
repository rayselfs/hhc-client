import { loadPdfjsLib } from '@renderer/lib/pdfjs-loader'
import type {
  ThumbnailWorkerRequest,
  ThumbnailWorkerResponse
} from '@renderer/lib/thumbnail-worker-client'

const MAX_SIZE = 256
const MAX_PDF_SIZE = 50 * 1024 * 1024
const JPEG_QUALITY = 0.8
const cancelled = new Set<string>()
let queue = Promise.resolve()

class BackgroundRenderingUnavailableError extends Error {}

function assertNotCancelled(id: string): void {
  if (cancelled.has(id)) throw new DOMException('Thumbnail rendering aborted', 'AbortError')
}

function createCanvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)))
}

class OffscreenCanvasFactory {
  create(
    width: number,
    height: number
  ): {
    canvas: OffscreenCanvas
    context: OffscreenCanvasRenderingContext2D
  } {
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Offscreen canvas context is unavailable')
    return { canvas, context }
  }

  reset(entry: { canvas: OffscreenCanvas }, width: number, height: number): void {
    entry.canvas.width = Math.max(1, Math.ceil(width))
    entry.canvas.height = Math.max(1, Math.ceil(height))
  }

  destroy(entry: {
    canvas: OffscreenCanvas | null
    context: OffscreenCanvasRenderingContext2D | null
  }): void {
    if (entry.canvas) entry.canvas.width = entry.canvas.height = 0
    entry.canvas = null
    entry.context = null
  }
}

class WorkerFilterFactory {
  addFilter(): string {
    return 'none'
  }
  addHCMFilter(): string {
    return 'none'
  }
  addAlphaFilter(): string {
    return 'none'
  }
  addLuminosityFilter(): string {
    return 'none'
  }
  addKnockoutFilter(): string {
    return 'none'
  }
  addHighlightHCMFilter(): string {
    return 'none'
  }
  addSelectionHCMFilter(): string {
    return 'none'
  }
  addSelectionFilter(): string {
    return 'none'
  }
  createSelectionStyle(): null {
    return null
  }
  destroy(): void {
    return undefined
  }
}

async function renderImage(id: string, file: File): Promise<Blob[]> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new BackgroundRenderingUnavailableError('Image rendering APIs are unavailable')
  }
  const bitmap = await createImageBitmap(file)
  try {
    assertNotCancelled(id)
    if (bitmap.width <= 0 || bitmap.height <= 0) return []
    const scale = Math.min(MAX_SIZE / bitmap.width, MAX_SIZE / bitmap.height)
    const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return []
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    assertNotCancelled(id)
    return [await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })]
  } finally {
    bitmap.close()
  }
}

async function renderPdf(id: string, file: File, allPages: boolean): Promise<Blob[]> {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new BackgroundRenderingUnavailableError('OffscreenCanvas is unavailable')
  }
  if (file.size > MAX_PDF_SIZE) return []
  const pdfjs = await loadPdfjsLib()
  const pdf = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    CanvasFactory: OffscreenCanvasFactory,
    FilterFactory: WorkerFilterFactory,
    disableFontFace: true,
    useSystemFonts: false
  }).promise

  try {
    const blobs: Blob[] = []
    const pageCount = allPages ? pdf.numPages : Math.min(1, pdf.numPages)
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      assertNotCancelled(id)
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const scale = Math.min(MAX_SIZE / viewport.width, MAX_SIZE / viewport.height)
      const renderViewport = page.getViewport({ scale })
      const canvas = createCanvas(renderViewport.width, renderViewport.height)
      const context = canvas.getContext('2d')
      if (!context) continue
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport: renderViewport
      }).promise
      assertNotCancelled(id)
      blobs.push(await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY }))
    }
    return blobs
  } finally {
    await pdf.loadingTask.destroy()
  }
}

async function handleRequest(
  request: Exclude<ThumbnailWorkerRequest, { type: 'cancel' }>
): Promise<void> {
  try {
    const blobs =
      request.type === 'pdf-pages'
        ? await renderPdf(request.id, request.file, true)
        : request.mimeType === 'application/pdf'
          ? await renderPdf(request.id, request.file, false)
          : await renderImage(request.id, request.file)
    if (!cancelled.has(request.id)) {
      self.postMessage({ id: request.id, ok: true, blobs } satisfies ThumbnailWorkerResponse)
    }
  } catch (error) {
    if (!cancelled.has(request.id)) {
      self.postMessage({
        id: request.id,
        ok: false,
        message: error instanceof Error ? error.message : 'Thumbnail rendering failed',
        code:
          error instanceof BackgroundRenderingUnavailableError
            ? 'background-rendering-unavailable'
            : undefined
      } satisfies ThumbnailWorkerResponse)
    }
  } finally {
    cancelled.delete(request.id)
  }
}

self.addEventListener('message', (event: MessageEvent<ThumbnailWorkerRequest>) => {
  if (event.data.type === 'cancel') {
    cancelled.add(event.data.id)
    return
  }
  const request = event.data
  queue = queue.then(() => handleRequest(request))
})

export {}
