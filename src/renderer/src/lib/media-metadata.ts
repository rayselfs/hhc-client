import { isElectron } from './env'
import {
  getFileBlobRecord,
  getFileSource,
  openFileExplorerDB,
  type FileSource
} from './file-explorer-db'
import { loadPdfjsLib } from './pdfjs-loader'
import { getDerivedAsset, putDerivedAsset, type DerivedAssetMetadata } from './media-work-db'

export const MEDIA_METADATA_VARIANT = 'source'

export async function getSourceMediaMetadata(
  blobId: string
): Promise<DerivedAssetMetadata | null> {
  const asset = await getDerivedAsset(blobId, 'media-metadata', MEDIA_METADATA_VARIANT)
  return asset?.status === 'ready' ? (asset.metadata ?? null) : null
}

export async function putSourceMediaMetadata(
  blobId: string,
  metadata: DerivedAssetMetadata
): Promise<DerivedAssetMetadata> {
  await putDerivedAsset({
    sourceBlobId: blobId,
    kind: 'media-metadata',
    variant: MEDIA_METADATA_VARIANT,
    storage: 'indexed-db',
    mimeType: 'application/json',
    status: 'ready',
    metadata
  })
  return metadata
}

function withSource<T>(source: FileSource, read: (url: string) => Promise<T>): Promise<T> {
  return read(source.url).finally(() => source.revoke())
}

async function readImageMetadata(url: string): Promise<DerivedAssetMetadata> {
  const image = new Image()
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Unable to read image metadata'))
  })
  image.src = url
  await loaded
  return { kind: 'image', width: image.naturalWidth, height: image.naturalHeight }
}

async function readVideoMetadata(url: string): Promise<DerivedAssetMetadata> {
  const video = document.createElement('video')
  video.preload = 'metadata'
  const loaded = new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Unable to read video metadata'))
  })
  video.src = url
  await loaded
  video.removeAttribute('src')
  video.load()
  return {
    kind: 'video',
    width: video.videoWidth || undefined,
    height: video.videoHeight || undefined,
    durationMs:
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.round(video.duration * 1000)
        : undefined
  }
}

async function readPdfMetadata(url: string): Promise<DerivedAssetMetadata> {
  const pdfjsLib = await loadPdfjsLib()
  const pdf = await pdfjsLib.getDocument(url).promise
  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    return {
      kind: 'pdf',
      pageCount: pdf.numPages,
      firstPageWidth: viewport.width,
      firstPageHeight: viewport.height
    }
  } finally {
    await pdf.destroy()
  }
}

async function probeNativeVideo(blobId: string): Promise<DerivedAssetMetadata | null> {
  if (!isElectron()) return null
  const record = await getFileBlobRecord(blobId)
  if (record?.storage !== 'native-fs') return null
  if (!window.api?.videoTranscode?.probe) return null
  try {
    const result = await window.api.videoTranscode.probe({ sourceFileId: blobId })
    return { kind: 'video', ...result }
  } catch (error) {
    console.warn('[media-metadata] Video probe failed', { blobId, error })
    return null
  }
}

export async function ensureSourceMediaMetadata(
  blobId: string,
  mimeType: string
): Promise<DerivedAssetMetadata | null> {
  const existing = await getSourceMediaMetadata(blobId)
  if (existing) return existing

  let metadata: DerivedAssetMetadata | null = null
  if (mimeType.startsWith('video/')) {
    const record = await getFileBlobRecord(blobId)
    metadata = await probeNativeVideo(blobId)
    if (!metadata && record?.storage === 'native-fs') return null
  }

  if (!metadata) {
    const db = await openFileExplorerDB()
    const source = await getFileSource(db, blobId, mimeType)
    if (!source) return null
    metadata = await withSource(source, async (url) => {
      if (mimeType.startsWith('image/')) return readImageMetadata(url)
      if (mimeType.startsWith('video/')) return readVideoMetadata(url)
      if (mimeType === 'application/pdf') return readPdfMetadata(url)
      return null
    })
  }

  return metadata ? putSourceMediaMetadata(blobId, metadata) : null
}
