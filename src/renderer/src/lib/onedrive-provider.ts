import type {
  ReadOnlySyncProvider,
  RemoteSyncItem,
  SyncChangePage,
  SyncDownloadRequest,
  SyncDownloadResult,
  SyncProviderConnectionInfo
} from './sync-provider'
import { storeOneDriveProviderConnection, type OneDriveAccountProfile } from './onedrive-auth'

interface OneDriveProviderOptions {
  getAccessToken: () => Promise<string>
  fetchImpl?: typeof fetch
  saveDownloadedContent: (
    request: SyncDownloadRequest,
    response: Response,
    metadata: RemoteSyncItem
  ) => Promise<SyncDownloadResult>
}

interface GraphPage {
  value?: unknown
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
}

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function encodeGraphPathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, '')
}

function normalizeGraphItem(value: unknown): RemoteSyncItem | null {
  if (!isRecord(value)) return null
  const id = getString(value.id)
  const name = getString(value.name)
  if (!id || !name) return null

  const parentReference = isRecord(value.parentReference) ? value.parentReference : {}
  const file = isRecord(value.file) ? value.file : undefined
  const deleted = isRecord(value.deleted)
  const kind = isRecord(value.folder) ? 'folder' : 'file'
  const hashes = file && isRecord(file.hashes) ? file.hashes : undefined

  return {
    remoteItemId: id,
    parentRemoteItemId: getString(parentReference.id) ?? null,
    kind,
    name,
    mimeType: getString(file?.mimeType),
    size: getNumber(value.size),
    etag: getString(value.eTag) ?? getString(value.etag),
    contentHash: getString(hashes?.quickXorHash),
    deleted
  }
}

function normalizeGraphPage(value: unknown): SyncChangePage {
  if (!isRecord(value)) {
    return { items: [], hasMore: false }
  }
  const page = value as GraphPage
  const rawItems = Array.isArray(page.value) ? page.value : []
  const nextCursor = page['@odata.nextLink'] ?? page['@odata.deltaLink']
  return {
    items: rawItems.flatMap((item) => {
      const normalized = normalizeGraphItem(item)
      return normalized ? [normalized] : []
    }),
    nextCursor,
    hasMore: typeof page['@odata.nextLink'] === 'string'
  }
}

export class OneDriveReadonlyProvider implements ReadOnlySyncProvider {
  readonly providerType = 'onedrive' as const

  private readonly getAccessToken: () => Promise<string>
  private readonly fetchImpl: typeof fetch
  private readonly saveDownloadedContent: OneDriveProviderOptions['saveDownloadedContent']

  constructor(options: OneDriveProviderOptions) {
    this.getAccessToken = options.getAccessToken
    this.fetchImpl = options.fetchImpl ?? fetch
    this.saveDownloadedContent = options.saveDownloadedContent
  }

  async connect(): Promise<SyncProviderConnectionInfo> {
    const profile = await this.fetchJson<OneDriveAccountProfile>('/me')
    const connection = await storeOneDriveProviderConnection(profile)
    return {
      id: connection.id,
      providerType: connection.providerType,
      displayName: connection.displayName,
      accountLabel: connection.accountLabel
    }
  }

  async disconnect(): Promise<void> {
    // Credential deletion and metadata cleanup are handled by the caller so the provider remains
    // read-only with respect to OneDrive.
  }

  async initialScan(providerConnectionId: string, remoteFolderId: string): Promise<SyncChangePage> {
    void providerConnectionId
    const path =
      remoteFolderId === 'root'
        ? '/me/drive/root/delta'
        : `/me/drive/items/${encodeGraphPathSegment(remoteFolderId)}/delta`
    return normalizeGraphPage(await this.fetchJson(path))
  }

  async listFolders(parentRemoteFolderId: string): Promise<RemoteSyncItem[]> {
    const path =
      parentRemoteFolderId === 'root'
        ? '/me/drive/root/children'
        : `/me/drive/items/${encodeGraphPathSegment(parentRemoteFolderId)}/children`
    const folders: RemoteSyncItem[] = []
    let nextPath: string | undefined = path

    while (nextPath) {
      const page = normalizeGraphPage(await this.fetchJson(nextPath))
      folders.push(...page.items.filter((item) => item.kind === 'folder' && !item.deleted))
      nextPath = page.hasMore ? page.nextCursor : undefined
    }

    return folders
  }

  async incrementalChanges(input: {
    providerConnectionId: string
    remoteFolderId: string
    cursor: string
  }): Promise<SyncChangePage> {
    void input.providerConnectionId
    void input.remoteFolderId
    return normalizeGraphPage(await this.fetchJson(input.cursor))
  }

  async getMetadata(providerConnectionId: string, remoteItemId: string): Promise<RemoteSyncItem> {
    void providerConnectionId
    const item = normalizeGraphItem(
      await this.fetchJson(`/me/drive/items/${encodeGraphPathSegment(remoteItemId)}`)
    )
    if (!item) throw new Error('Invalid OneDrive metadata response')
    return item
  }

  async downloadContent(
    request: SyncDownloadRequest,
    signal: AbortSignal
  ): Promise<SyncDownloadResult> {
    const metadata = await this.getMetadata(request.providerConnectionId, request.remoteItemId)
    const response = await this.request(
      `/me/drive/items/${encodeGraphPathSegment(request.remoteItemId)}/content`,
      { signal }
    )
    if (!response.ok) throw new Error(`OneDrive download failed: ${response.status}`)
    return this.saveDownloadedContent(request, response, metadata)
  }

  classifyError(error: unknown): 'retryable' | 'auth-required' | 'offline' | 'fatal' {
    if (error instanceof TypeError) return 'offline'
    if (isRecord(error)) {
      const status = getNumber(error.status)
      if (status === 401 || status === 403) return 'auth-required'
      if (
        status !== undefined &&
        (status === 408 || status === 409 || status === 423 || status === 429 || status >= 500)
      ) {
        return 'retryable'
      }
    }
    return 'fatal'
  }

  private async fetchJson<T = unknown>(pathOrUrl: string): Promise<T> {
    const response = await this.request(pathOrUrl)
    if (!response.ok) {
      throw Object.assign(new Error(`OneDrive request failed: ${response.status}`), {
        status: response.status
      })
    }
    return (await response.json()) as T
  }

  private async request(pathOrUrl: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken()
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH_BASE_URL}${pathOrUrl}`
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return this.fetchImpl(url, { ...init, headers })
  }
}
