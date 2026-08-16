import { isElectron } from './env'
import type {
  HhcAssetCollectionChangePage,
  HhcAssetCollectionItem,
  HhcAssetCollectionPage,
  HhcAssetContentRequest,
  HhcAssetContentTicket
} from '@shared/hhc-assets'
import type { SyncRemoteContentSource } from './sync-provider'

export type HhcAssetErrorClassification = 'retryable' | 'auth-required' | 'access-revoked' | 'fatal'

export class HhcAssetApiError extends Error {
  constructor(
    readonly classification: HhcAssetErrorClassification,
    readonly status?: number
  ) {
    super('HHC Asset request failed')
  }
}

export interface HhcAssetApi {
  listCollections(cursor?: string): Promise<HhcAssetCollectionPage>
  getCollectionChanges(collectionId: string, cursor?: string): Promise<HhcAssetCollectionChangePage>
  getCollectionItem(collectionId: string, itemId: string): Promise<HhcAssetCollectionItem>
  issueContentTicket(collectionId: string, itemId: string): Promise<HhcAssetContentTicket>
  getRemoteContentSource(collectionId: string, itemId: string): Promise<SyncRemoteContentSource>
  downloadContent(
    request: HhcAssetContentRequest,
    signal?: AbortSignal
  ): Promise<Response | { fileId: string; size: number; mimeType: string }>
}

export async function createHhcAssetApi(): Promise<HhcAssetApi> {
  if (isElectron()) {
    const { createElectronHhcAssetApi } = await import('./hhc-asset-api-electron')
    return createElectronHhcAssetApi()
  }

  const [{ createBrowserHhcAssetApi }, { createHhcAuthAdapter }] = await Promise.all([
    import('./hhc-asset-api-browser'),
    import('./hhc-auth')
  ])
  const auth = await createHhcAuthAdapter()
  return createBrowserHhcAssetApi({
    getAccessToken: () => auth.getAccessToken(),
    refreshAccessToken: () => auth.refreshAccessToken()
  })
}
