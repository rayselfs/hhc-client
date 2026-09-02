import { HhcAssetApiError, type HhcAssetApi } from './hhc-asset-api'
import { APP_CONFIG } from '@shared/app-config'
import {
  parseHhcAssetChangePage,
  parseHhcAssetCollectionPage,
  parseHhcAssetItem
} from './hhc-asset-api-browser'

const LEASE_URL_PATTERN = /^hhc-media:\/\/lease\/[0-9a-f-]{36}\?type=/

async function invoke<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('HHC_ASSET_AUTH_REQUIRED')) {
      throw new HhcAssetApiError('auth-required', 401)
    }
    if (message.includes('HHC_ASSET_ACCESS_REVOKED:404')) {
      throw new HhcAssetApiError('access-revoked', 404)
    }
    if (message.includes('HHC_ASSET_ACCESS_REVOKED')) {
      throw new HhcAssetApiError('access-revoked', 403)
    }
    if (message.includes('HHC_ASSET_RETRYABLE')) throw new HhcAssetApiError('retryable')
    throw new HhcAssetApiError('fatal')
  }
}

export function createElectronHhcAssetApi(): HhcAssetApi {
  return {
    listCollections: async (cursor) =>
      parseHhcAssetCollectionPage(await invoke(window.api.hhcAssets.listCollections(cursor))),
    getCollectionChanges: async (collectionId, cursor) =>
      parseHhcAssetChangePage(
        await invoke(window.api.hhcAssets.getCollectionChanges({ collectionId, cursor }))
      ),
    getCollectionItem: async (collectionId, itemId) =>
      parseHhcAssetItem(
        await invoke(window.api.hhcAssets.getCollectionItem({ collectionId, itemId }))
      ),
    issueContentTicket: async (collectionId, itemId) => {
      const ticket = await invoke(window.api.hhcAssets.issueContentTicket({ collectionId, itemId }))
      if (
        !ticket.contentUrl.startsWith(`${APP_CONFIG.hhcAssetOrigin}/api/assets/content?ticket=`) ||
        !Number.isFinite(ticket.expiresAt) ||
        !ticket.etag
      ) {
        throw new HhcAssetApiError('fatal')
      }
      return ticket
    },
    recordSyncReceipt: (receipt) => invoke(window.api.hhcAssets.recordSyncReceipt(receipt)),
    getRemoteContentSource: async (collectionId, itemId) => {
      const lease = await invoke(window.api.hhcAssets.createContentLease({ collectionId, itemId }))
      if (
        lease.kind !== 'native-lease' ||
        !LEASE_URL_PATTERN.test(lease.url) ||
        !/^[0-9a-f-]{36}$/.test(lease.leaseId) ||
        !lease.etag
      ) {
        throw new HhcAssetApiError('fatal')
      }
      return lease
    },
    downloadContent: (request) => {
      if (!request.targetFileId) throw new HhcAssetApiError('fatal')
      return invoke(
        window.api.hhcAssets.downloadFile({
          collectionId: request.collectionId,
          itemId: request.itemId,
          rootRemoteFolderId: request.rootRemoteFolderId,
          targetFileId: request.targetFileId
        })
      ).then((downloaded) => {
        if (
          downloaded.fileId !== request.targetFileId ||
          !Number.isFinite(downloaded.size) ||
          downloaded.size <= 0 ||
          !downloaded.mimeType
        ) {
          throw new HhcAssetApiError('fatal')
        }
        return downloaded
      })
    }
  }
}
