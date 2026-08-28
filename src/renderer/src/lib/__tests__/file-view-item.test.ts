import { describe, expect, it } from 'vitest'
import { buildFolderViewItem } from '../file-view-item'

describe('buildFolderViewItem', () => {
  it.each(['local-fs', 'onedrive', 'hhc-line'] as const)(
    'preserves %s provider metadata for a favorited sync root',
    (providerType) => {
      const item = buildFolderViewItem({
        id: 'sync-root',
        name: 'Sync root',
        parentId: 'file-root',
        createdAt: 1,
        isFavorited: true,
        syncLink: {
          providerType,
          providerConnectionId: 'connection',
          remoteFolderId: 'remote',
          status: 'active'
        }
      })

      expect(item.syncProviderType).toBe(providerType)
      expect(item.isFavorited).toBe(true)
    }
  )
})
