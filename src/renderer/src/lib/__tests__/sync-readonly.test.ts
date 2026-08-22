import { describe, expect, it } from 'vitest'
import type { FolderRecord } from '@shared/types/folder'
import { getReadOnlySyncAncestor, isFolderReadOnlyBySyncLink } from '../sync-readonly'

function folder(id: string, parentId: string | null, sync = false): FolderRecord {
  return {
    id,
    name: id,
    parentId,
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    syncLink: sync
      ? {
          providerConnectionId: 'connection-1',
          remoteFolderId: 'remote-folder-1',
          providerType: 'onedrive',
          offlinePolicy: 'on-demand'
        }
      : undefined
  }
}

describe('sync read-only helpers', () => {
  it('marks a sync-linked folder and descendants as read-only', () => {
    const folders = {
      root: folder('root', null),
      synced: folder('synced', 'root', true),
      child: folder('child', 'synced'),
      normal: folder('normal', 'root')
    }

    expect(isFolderReadOnlyBySyncLink('synced', folders)).toBe(true)
    expect(isFolderReadOnlyBySyncLink('child', folders)).toBe(true)
    expect(isFolderReadOnlyBySyncLink('normal', folders)).toBe(false)
  })

  it('returns the nearest sync ancestor', () => {
    const folders = {
      root: folder('root', null),
      synced: folder('synced', 'root', true),
      child: folder('child', 'synced')
    }

    expect(getReadOnlySyncAncestor('child', folders)?.id).toBe('synced')
  })

  it('handles missing folders and parent cycles defensively', () => {
    const folders = {
      a: folder('a', 'b'),
      b: folder('b', 'a')
    }

    expect(isFolderReadOnlyBySyncLink('missing', folders)).toBe(false)
    expect(isFolderReadOnlyBySyncLink('a', folders)).toBe(false)
  })
})
