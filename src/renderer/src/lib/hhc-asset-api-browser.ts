import { APP_CONFIG } from '@shared/app-config'
import type {
  HhcAssetCollection,
  HhcAssetCollectionChangePage,
  HhcAssetCollectionItem,
  HhcAssetCollectionPage,
  HhcAssetCollectionTombstone
} from '@shared/hhc-assets'
import { HhcAssetApiError, type HhcAssetApi } from './hhc-asset-api'

const HHC_ASSET_ORIGIN = 'https://www.alive.org.tw'
const RANGE_PATTERN = /^bytes=(?:\d+-\d*|-\d+)$/

type BrowserHhcAssetApiOptions = {
  origin?: string
  getAccessToken: () => Promise<string | null>
  refreshAccessToken: () => Promise<string | null>
  fetcher?: typeof fetch
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function string(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseCollection(value: unknown): HhcAssetCollection {
  if (!isRecord(value)) throw new HhcAssetApiError('fatal')
  const id = string(value.id)
  const namespace = string(value.namespace)
  const name = string(value.name)
  const revision = finiteNumber(value.revision)
  const createdAt = string(value.createdAt)
  const updatedAt = string(value.updatedAt)
  const deletedAt = value.deletedAt === undefined ? undefined : string(value.deletedAt)
  if (
    !id ||
    !namespace ||
    !name ||
    revision === null ||
    !createdAt ||
    !updatedAt ||
    deletedAt === null
  ) {
    throw new HhcAssetApiError('fatal')
  }
  return {
    id,
    namespace,
    name,
    revision,
    createdAt,
    updatedAt,
    ...(deletedAt ? { deletedAt } : {})
  }
}

export function parseHhcAssetItem(value: unknown): HhcAssetCollectionItem {
  if (!isRecord(value)) throw new HhcAssetApiError('fatal')
  const required = {
    id: string(value.id),
    collectionId: string(value.collectionId),
    remoteItemId: string(value.remoteItemId),
    displayName: string(value.displayName),
    sourceRevision: string(value.sourceRevision),
    createdRevision: finiteNumber(value.createdRevision),
    createdAt: string(value.createdAt)
  }
  if (Object.values(required).some((entry) => entry === null || entry === '')) {
    throw new HhcAssetApiError('fatal')
  }
  const optionalString = (key: 'mimeType' | 'etag' | 'deletedAt'): string | undefined => {
    const entry = value[key]
    if (entry === undefined) return undefined
    const parsed = string(entry)
    if (parsed === null) throw new HhcAssetApiError('fatal')
    return parsed
  }
  const optionalNumber = (key: 'sizeBytes' | 'deletedRevision'): number | undefined => {
    const entry = value[key]
    if (entry === undefined) return undefined
    const parsed = finiteNumber(entry)
    if (parsed === null) throw new HhcAssetApiError('fatal')
    return parsed
  }
  return {
    id: required.id!,
    collectionId: required.collectionId!,
    remoteItemId: required.remoteItemId!,
    displayName: required.displayName!,
    sourceRevision: required.sourceRevision!,
    createdRevision: required.createdRevision!,
    createdAt: required.createdAt!,
    ...(optionalNumber('deletedRevision') === undefined
      ? {}
      : { deletedRevision: optionalNumber('deletedRevision') }),
    ...(optionalString('mimeType') === undefined ? {} : { mimeType: optionalString('mimeType') }),
    ...(optionalNumber('sizeBytes') === undefined
      ? {}
      : { sizeBytes: optionalNumber('sizeBytes') }),
    ...(optionalString('etag') === undefined ? {} : { etag: optionalString('etag') }),
    ...(optionalString('deletedAt') === undefined ? {} : { deletedAt: optionalString('deletedAt') })
  }
}

function parseTombstone(value: unknown): HhcAssetCollectionTombstone {
  if (!isRecord(value)) throw new HhcAssetApiError('fatal')
  const id = string(value.id)
  const remoteItemId = string(value.remoteItemId)
  const deletedRevision = finiteNumber(value.deletedRevision)
  const deletedAt = string(value.deletedAt)
  if (!id || !remoteItemId || deletedRevision === null || !deletedAt) {
    throw new HhcAssetApiError('fatal')
  }
  return { id, remoteItemId, deletedRevision, deletedAt }
}

export function parseHhcAssetCollectionPage(value: unknown): HhcAssetCollectionPage {
  if (!isRecord(value) || !Array.isArray(value.collections) || typeof value.hasMore !== 'boolean') {
    throw new HhcAssetApiError('fatal')
  }
  const cursor = value.cursor === undefined ? undefined : string(value.cursor)
  if (cursor === null) throw new HhcAssetApiError('fatal')
  return {
    collections: value.collections.map(parseCollection),
    ...(cursor ? { cursor } : {}),
    hasMore: value.hasMore
  }
}

export function parseHhcAssetChangePage(value: unknown): HhcAssetCollectionChangePage {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.tombstones) ||
    typeof value.hasMore !== 'boolean' ||
    typeof value.reset !== 'boolean' ||
    typeof value.cursor !== 'string'
  ) {
    throw new HhcAssetApiError('fatal')
  }
  return {
    collection: parseCollection(value.collection),
    items: value.items.map(parseHhcAssetItem),
    tombstones: value.tombstones.map(parseTombstone),
    cursor: value.cursor,
    hasMore: value.hasMore,
    reset: value.reset
  }
}

function classification(
  status: number
): 'retryable' | 'auth-required' | 'access-revoked' | 'fatal' {
  if (status === 401) return 'auth-required'
  if (status === 403) return 'access-revoked'
  if (status === 408 || status === 409 || status === 423 || status === 429 || status >= 500) {
    return 'retryable'
  }
  return 'fatal'
}

export function createBrowserHhcAssetApi(options: BrowserHhcAssetApiOptions): HhcAssetApi {
  const configuredOrigin = new URL(options.origin ?? APP_CONFIG.hhcAssetOrigin).origin
  if (configuredOrigin !== HHC_ASSET_ORIGIN) throw new Error('Invalid HHC Asset origin')
  const fetcher = options.fetcher ?? ((...args) => window.fetch(...args))

  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const send = async (token: string): Promise<Response> => {
      const headers = new Headers(init.headers)
      headers.set('accept', headers.get('accept') ?? 'application/json')
      headers.set('authorization', `Bearer ${token}`)
      try {
        return await fetcher(`${configuredOrigin}${path}`, { ...init, headers })
      } catch {
        throw new HhcAssetApiError('retryable')
      }
    }
    const firstToken = await options.getAccessToken()
    if (!firstToken) throw new HhcAssetApiError('auth-required', 401)
    let response = await send(firstToken)
    if (response.status === 401) {
      const refreshed = await options.refreshAccessToken()
      if (!refreshed) throw new HhcAssetApiError('auth-required', 401)
      response = await send(refreshed)
    }
    if (!response.ok) throw new HhcAssetApiError(classification(response.status), response.status)
    return response
  }

  const json = async (path: string, init?: RequestInit): Promise<unknown> => {
    try {
      return await (await request(path, init)).json()
    } catch (error) {
      if (error instanceof HhcAssetApiError) throw error
      throw new HhcAssetApiError('fatal')
    }
  }

  return {
    async listCollections(cursor) {
      const params = new URLSearchParams({ limit: '500' })
      if (cursor) params.set('cursor', cursor)
      return parseHhcAssetCollectionPage(await json(`/api/assets/collections?${params}`))
    },
    async getCollectionChanges(collectionId, cursor) {
      const query = cursor ? `?${new URLSearchParams({ cursor })}` : ''
      return parseHhcAssetChangePage(
        await json(`/api/assets/collections/${encodeURIComponent(collectionId)}/changes${query}`)
      )
    },
    async getCollectionItem(collectionId, itemId) {
      return parseHhcAssetItem(
        await json(
          `/api/assets/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`
        )
      )
    },
    async issueContentTicket(collectionId, itemId) {
      const value = await json(
        `/api/assets/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}/content-ticket`,
        { method: 'POST' }
      )
      if (!isRecord(value)) throw new HhcAssetApiError('fatal')
      const contentUrl = string(value.contentUrl)
      const expiresAt = string(value.expiresAt)
      const etag = string(value.etag)
      const parsedExpiry = expiresAt ? Date.parse(expiresAt) : Number.NaN
      if (
        !contentUrl ||
        !contentUrl.startsWith('/api/assets/content?ticket=') ||
        !etag ||
        !Number.isFinite(parsedExpiry)
      ) {
        throw new HhcAssetApiError('fatal')
      }
      return { contentUrl: `${configuredOrigin}${contentUrl}`, expiresAt: parsedExpiry, etag }
    },
    async getRemoteContentSource(collectionId, itemId) {
      const ticket = await this.issueContentTicket(collectionId, itemId)
      return {
        kind: 'ticket',
        url: ticket.contentUrl,
        expiresAt: ticket.expiresAt,
        etag: ticket.etag
      }
    },
    async downloadContent(input, signal) {
      if (input.range && !RANGE_PATTERN.test(input.range)) throw new HhcAssetApiError('fatal')
      const headers = new Headers()
      headers.set('accept', '*/*')
      if (input.range) headers.set('range', input.range)
      return request(
        `/api/assets/collections/${encodeURIComponent(input.collectionId)}/items/${encodeURIComponent(input.itemId)}/content`,
        { headers, signal }
      )
    }
  }
}
