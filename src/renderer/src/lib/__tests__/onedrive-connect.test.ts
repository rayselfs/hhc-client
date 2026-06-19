import { describe, expect, it } from 'vitest'
import { FILE_EXPLORER_ROOT_ID } from '@renderer/stores/file-explorer'
import { buildOneDriveImportPlan } from '../onedrive-connect'

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
          name: 'cue.mp3',
          mimeType: 'audio/mpeg',
          size: 2048,
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
      name: 'cue.mp3',
      parentId: plan.folders[1].id
    })
  })
})
