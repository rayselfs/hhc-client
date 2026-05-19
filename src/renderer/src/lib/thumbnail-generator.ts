import { loadPdfjsLib } from './pdfjs-loader'

const THUMBNAIL_MAX_SIZE = 256
const JPEG_QUALITY = 0.8

function createCanvas(width = THUMBNAIL_MAX_SIZE, height = THUMBNAIL_MAX_SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function drawContainFit(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  background: string | null = null
): string | null {
  if (sourceWidth <= 0 || sourceHeight <= 0) return null

  const scale = Math.min(THUMBNAIL_MAX_SIZE / sourceWidth, THUMBNAIL_MAX_SIZE / sourceHeight)
  const canvasWidth = Math.round(sourceWidth * scale)
  const canvasHeight = Math.round(sourceHeight * scale)

  const canvas = createCanvas(canvasWidth, canvasHeight)
  const context = canvas.getContext('2d')
  if (!context) return null

  if (background) {
    context.fillStyle = background
    context.fillRect(0, 0, canvasWidth, canvasHeight)
  } else {
    context.clearRect(0, 0, canvasWidth, canvasHeight)
  }

  context.drawImage(source, 0, 0, canvasWidth, canvasHeight)

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    image.src = objectUrl
  })
}

async function generateImageThumbnail(file: File): Promise<string | null> {
  const image = await loadImage(file)
  return drawContainFit(image, image.naturalWidth, image.naturalHeight)
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      video.removeEventListener(eventName, handleEvent)
      video.removeEventListener('error', handleError)
    }
    const handleEvent = (): void => {
      cleanup()
      resolve()
    }
    const handleError = (): void => {
      cleanup()
      reject(new Error(`Video ${eventName} failed`))
    }

    video.addEventListener(eventName, handleEvent, { once: true })
    video.addEventListener('error', handleError, { once: true })
  })
}

async function generateVideoThumbnail(file: File): Promise<string | null> {
  const video = document.createElement('video')
  const objectUrl = URL.createObjectURL(file)

  try {
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = objectUrl

    await waitForVideoEvent(video, 'loadedmetadata')

    const targetTime = Math.min(0.1, Number.isFinite(video.duration) ? video.duration : 0.1)
    video.currentTime = targetTime
    await waitForVideoEvent(video, 'seeked')

    return drawContainFit(video, video.videoWidth, video.videoHeight)
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

async function generatePdfThumbnail(file: File): Promise<string | null> {
  const pdfjsLib = await loadPdfjsLib()

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const scale = Math.min(
      THUMBNAIL_MAX_SIZE / viewport.width,
      THUMBNAIL_MAX_SIZE / viewport.height
    )
    const renderViewport = page.getViewport({ scale })
    const canvas = createCanvas(Math.ceil(renderViewport.width), Math.ceil(renderViewport.height))
    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvas, canvasContext: context, viewport: renderViewport }).promise

    return drawContainFit(canvas, canvas.width, canvas.height, '#ffffff')
  } finally {
    await pdf.destroy()
  }
}

export async function generateThumbnail(file: File): Promise<string | null> {
  try {
    if (file.type.startsWith('image/')) return await generateImageThumbnail(file)
    if (file.type.startsWith('video/')) return await generateVideoThumbnail(file)
    if (file.type === 'application/pdf') return await generatePdfThumbnail(file)
    return null
  } catch (error) {
    console.error('Failed to generate thumbnail', error)
    return null
  }
}
