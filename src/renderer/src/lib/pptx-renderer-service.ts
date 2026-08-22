import type { PptxViewer, SlideHandle } from '@aiden0z/pptx-renderer'

const PPTX_THUMBNAIL_SIZE = 256
const PPTX_THUMBNAIL_QUALITY = 0.82

export interface OpenPptxViewerOptions {
  renderMode?: 'list' | 'slide'
  signal?: AbortSignal
}

export interface PptxViewerHandle {
  viewer: PptxViewer
  slideCount: number
  slideWidth: number
  slideHeight: number
  destroy: () => void
}

async function loadRenderer(): Promise<typeof import('@aiden0z/pptx-renderer')> {
  return import('@aiden0z/pptx-renderer')
}

export async function openPptxViewer(
  input: ArrayBuffer | Uint8Array | Blob,
  container: HTMLElement,
  options: OpenPptxViewerOptions = {}
): Promise<PptxViewerHandle> {
  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await loadRenderer()
  const viewer = await PptxViewer.open(input, container, {
    renderMode: options.renderMode ?? 'slide',
    fitMode: 'contain',
    lazyMedia: true,
    lazySlides: true,
    pdfjs: false,
    signal: options.signal,
    zipLimits: RECOMMENDED_ZIP_LIMITS
  })

  return {
    viewer,
    slideCount: viewer.slideCount,
    slideWidth: viewer.slideWidth,
    slideHeight: viewer.slideHeight,
    destroy: () => viewer.destroy()
  }
}

function createHiddenHost(width: number, height: number): HTMLDivElement {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = `${width}px`
  host.style.height = `${height}px`
  host.style.overflow = 'hidden'
  host.style.pointerEvents = 'none'
  host.setAttribute('aria-hidden', 'true')
  document.body.append(host)
  return host
}

function getThumbnailHeight(viewer: PptxViewerHandle, width: number): number {
  if (viewer.slideWidth > 0 && viewer.slideHeight > 0) {
    return Math.max(1, Math.round((width * viewer.slideHeight) / viewer.slideWidth))
  }
  return width
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load PPTX thumbnail image'))
    image.src = url
  })
}

async function elementToJpegDataUrl(
  element: HTMLElement,
  width: number,
  height: number
): Promise<string | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  const html = new XMLSerializer().serializeToString(element)
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<foreignObject width="100%" height="100%">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:#fff;overflow:hidden">`,
    html,
    '</div>',
    '</foreignObject>',
    '</svg>'
  ].join('')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = await loadImage(url)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', PPTX_THUMBNAIL_QUALITY)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function generatePptxFirstSlideThumbnail(file: File): Promise<string | null> {
  let slideHandle: SlideHandle | null = null
  const host = createHiddenHost(PPTX_THUMBNAIL_SIZE, PPTX_THUMBNAIL_SIZE)
  const viewerContainer = document.createElement('div')
  const thumbnailContainer = document.createElement('div')
  host.append(viewerContainer, thumbnailContainer)

  try {
    const viewer = await openPptxViewer(await file.arrayBuffer(), viewerContainer, {
      renderMode: 'slide'
    })
    try {
      if (viewer.slideCount < 1) return null

      const width = PPTX_THUMBNAIL_SIZE
      const height = getThumbnailHeight(viewer, width)
      host.style.height = `${height}px`
      thumbnailContainer.style.width = `${width}px`
      thumbnailContainer.style.height = `${height}px`

      slideHandle = viewer.viewer.renderThumbnailToContainer(0, thumbnailContainer, { width })
      if (!slideHandle) return null
      await slideHandle.ready

      return elementToJpegDataUrl(thumbnailContainer, width, height)
    } finally {
      viewer.destroy()
    }
  } finally {
    slideHandle?.dispose()
    host.remove()
  }
}
