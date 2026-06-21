import { describe, expect, it } from 'vitest'
import { FILE_EXPLORER_ROOT_ID } from '@renderer/stores/file-explorer'
import { buildOneDriveImportPlan } from '../onedrive-connect'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('buildOneDriveImportPlan', () => {
  it('mounts the selected OneDrive folder instead of the account root', () => {
    const plan = buildOneDriveImportPlan({
      connectionId: 'onedrive:account-1',
      displayName: 'Drama Audio',
      rootRemoteFolderId: 'remote-folder-1',
      offlinePolicy: 'always-offline',
      existingRootFolderNames: [],
      platform: 'electron',
      remoteItems: [
        {
          remoteItemId: 'remote-folder-1',
          parentRemoteItemId: 'root',
          kind: 'folder',
          name: 'Drama Audio',
          deleted: false
        },
        {
          remoteItemId: 'child-folder-1',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'folder',
          name: 'Scene 1',
          deleted: false
        },
        {
          remoteItemId: 'file-1',
          parentRemoteItemId: 'child-folder-1',
          kind: 'file',
          name: 'cue.mp4',
          mimeType: 'video/mp4',
          size: 2048,
          deleted: false
        },
        {
          remoteItemId: 'system-file',
          parentRemoteItemId: 'child-folder-1',
          kind: 'file',
          name: '.DS_Store',
          size: 100,
          deleted: false
        }
      ]
    })

    expect(plan.folders[0]).toMatchObject({
      name: 'Drama Audio',
      parentId: FILE_EXPLORER_ROOT_ID,
      syncLink: {
        remoteFolderId: 'remote-folder-1',
        providerType: 'onedrive'
      }
    })
    expect(plan.syncEntries[0]).toMatchObject({
      remoteItemId: 'remote-folder-1',
      parentRemoteItemId: null,
      kind: 'folder',
      folderId: plan.folders[0].id
    })
    expect(plan.folders).toHaveLength(2)
    expect(plan.folders[1]).toMatchObject({
      name: 'Scene 1',
      parentId: plan.folders[0].id
    })
    expect(plan.items[0]).toMatchObject({
      name: 'cue.mp4',
      parentId: plan.folders[1].id
    })
    expect(plan.items.find((item) => item.name === '.DS_Store')).toBeUndefined()
    expect(plan.items[0].id).toMatch(UUID_PATTERN)
    expect(plan.downloadableItems[0]).toMatchObject({ itemId: plan.items[0].id })
  })
})
