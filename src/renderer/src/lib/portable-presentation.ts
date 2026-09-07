import type { EditablePresentationDocument } from './editable-presentation'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid portable presentation document')
}

function orderedMap(order: unknown, values: unknown, limit: number): void {
  requireValid(record(values) && Array.isArray(order))
  requireValid(order.length <= limit && Object.keys(values).length === order.length)
  requireValid(new Set(order).size === order.length)
  for (const id of order) {
    requireValid(typeof id === 'string' && id.length > 0 && Object.hasOwn(values, id))
  }
}

function dimension(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100000
}

function coordinate(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000
}

function validateImage(mimeType: unknown, dataUrl: unknown): void {
  requireValid(typeof mimeType === 'string' && typeof dataUrl === 'string')
  const prefix = `data:${mimeType};base64,`
  requireValid(dataUrl.startsWith(prefix))
  const encoded = dataUrl.slice(prefix.length)
  requireValid(encoded.length <= 4 * Math.ceil((20 * 1024 * 1024) / 3))
  const data = atob(encoded)
  requireValid(data.length > 0 && data.length <= 20 * 1024 * 1024 && btoa(data) === encoded)
  switch (mimeType) {
    case 'image/png':
      requireValid(data.startsWith('\x89PNG\r\n\x1a\n'))
      break
    case 'image/jpeg':
      requireValid(data.startsWith('\xff\xd8\xff'))
      break
    case 'image/gif':
      requireValid(data.startsWith('GIF87a') || data.startsWith('GIF89a'))
      break
    case 'image/bmp':
      requireValid(data.startsWith('BM'))
      break
    case 'image/webp':
      requireValid(
        data.length >= 16 &&
          data.startsWith('RIFF') &&
          data.slice(8, 12) === 'WEBP' &&
          data.slice(12, 15) === 'VP8'
      )
      break
    default:
      throw new Error('Unsupported portable presentation image')
  }
}

// Keep graph, image and geometry limits aligned with asset-api ValidatePersonalDeck.
export function validatePortablePresentation(
  document: Partial<EditablePresentationDocument>
): void {
  requireValid(record(document))
  if (document.schemaVersion !== undefined && document.schemaVersion !== 1) {
    throw new Error('Unsupported presentation schema version')
  }
  requireValid(typeof document.id === 'string' && document.id.trim())
  requireValid(typeof document.name === 'string' && document.name.trim())
  requireValid(dimension(document.width) && dimension(document.height))
  orderedMap(document.slideOrder, document.slides, 2000)
  const themes = document.themes ?? {}
  const assets = document.assets ?? {}
  requireValid(record(themes) && Object.keys(themes).length <= 2000)
  requireValid(record(assets) && Object.keys(assets).length <= 10000)
  requireValid(!document.defaultThemeId || Object.hasOwn(themes, document.defaultThemeId))
  let totalElements = 0
  for (const [id, slide] of Object.entries(document.slides ?? {})) {
    requireValid(record(slide) && slide.id === id)
    requireValid(!slide.themeId || Object.hasOwn(themes, slide.themeId))
    orderedMap(slide.elementOrder, slide.elements, 10000)
    totalElements += slide.elementOrder.length
    requireValid(totalElements <= 100000)
    for (const [elementId, element] of Object.entries(slide.elements)) {
      requireValid(record(element) && element.id === elementId)
      requireValid(coordinate(element.x) && coordinate(element.y) && coordinate(element.rotation))
      requireValid(
        typeof element.opacity === 'number' &&
          Number.isFinite(element.opacity) &&
          element.opacity >= 0 &&
          element.opacity <= 1
      )
      if (element.type === 'line') {
        requireValid(coordinate(element.width) && coordinate(element.height))
      } else {
        requireValid(dimension(element.width) && dimension(element.height))
      }
      requireValid(['text', 'image', 'shape', 'line', 'locked'].includes(element.type))
      if (element.type === 'image') requireValid(Object.hasOwn(assets, element.assetId))
    }
  }
  for (const [id, asset] of Object.entries(assets)) {
    requireValid(id && record(asset) && asset.id === id)
    validateImage(asset.mimeType, asset.dataUrl)
  }
}
