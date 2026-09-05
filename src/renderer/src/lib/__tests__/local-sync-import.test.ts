import { describe, expect, it } from 'vitest'
import type { LocalSyncConnectionInfo, LocalSyncRemoteItem } from '@shared/ipc-channels'
import { buildLocalSyncImportPlan, classifySyncRemoteFile } from '@renderer/lib/local-sync-import'

const connection: LocalSyncConnectionInfo = {
  id: 'connection-1',
  displayName: 'Media',
  rootName: 'Media',
  createdAt: 100,
  updatedAt: 100
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('classifySyncRemoteFile', () => {
  it('uses the web media policy for synced file support', () => {
    expect(classifySyncRemoteFile({ name: 'sermon.mkv' }, 'web')).toMatchObject({
      mimeType: 'video/x-matroska',
      support: 'native',
      disabled: false
    })

    expect(classifySyncRemoteFile({ name: 'legacy.avi' }, 'web')).toMatchObject({
      mimeType: 'video/x-msvideo',
      support: 'unsupported',
      disabled: true
    })
  })

  it('uses the electron media policy for synced file support', () => {
    expect(classifySyncRemoteFile({ name: 'legacy.avi' }, 'electron')).toMatchObject({
      mimeType: 'video/x-msvideo',
      support: 'desktop-engine',
      disabled: false
    })
  })
})

describe('buildLocalSyncImportPlan', () => {
  it('creates read-only folders and disables unsupported synced files', () => {
    const remoteItems: LocalSyncRemoteItem[] = [
      {
        remoteItemId: 'folder-a',
        parentRemoteItemId: null,
        kind: 'folder',
        name: 'Sunday',
        sourceCreatedAt: 200
      },
      {
        remoteItemId: 'mkv-1',
        parentRemoteItemId: 'folder-a',
        kind: 'file',
        name: 'clip.mkv',
        size: 10,
        sourceCreatedAt: 300
      },
      {
        remoteItemId: 'avi-1',
        parentRemoteItemId: 'folder-a',
        kind: 'file',
        name: 'clip.avi',
        size: 20
      },
      {
        remoteItemId: 'psd-1',
        parentRemoteItemId: 'folder-a',
        kind: 'file',
        name: 'layout.psd',
        mimeType: 'image/vnd.adobe.photoshop',
        size: 20
      },
      {
        remoteItemId: 'system-file',
        parentRemoteItemId: 'folder-a',
        kind: 'file',
        name: '.DS_Store',
        size: 20
      }
    ]

    const plan = buildLocalSyncImportPlan({
      connection,
      remoteItems,
      platform: 'web',
      existingRootFolderNames: []
    })

    expect(plan.rootFolder.syncLink).toEqual({
      providerConnectionId: connection.id,
      remoteFolderId: '.',
      providerType: 'local-fs',
      offlinePolicy: 'always-offline'
    })
    expect(plan.folders).toHaveLength(2)
    expect(plan.rootFolder.createdAt).not.toBe(200)
    expect(plan.folders.find((folder) => folder.name === 'Sunday')?.createdAt).toBe(200)
    expect(plan.items).toHaveLength(2)
    expect(plan.items.find((item) => item.name === '.DS_Store')).toBeUndefined()
    expect(plan.items.find((item) => item.name === 'layout.psd')).toBeUndefined()
    expect(plan.fileImports.map((entry) => entry.remoteItemId)).toEqual(['mkv-1'])
    expect(plan.fileImports[0].itemId).toMatch(UUID_PATTERN)
    expect(plan.items.find((item) => item.name === 'clip.mkv')).toMatchObject({
      id: plan.fileImports[0].itemId,
      createdAt: 300,
      mimeType: 'video/x-matroska',
      url: expect.stringMatching(/^blob:/)
    })
    expect(plan.items.find((item) => item.name === 'clip.avi')).toMatchObject({
      mimeType: 'video/x-msvideo',
      url: expect.stringMatching(/^unsupported:/)
    })
    expect(plan.syncEntries.find((entry) => entry.remoteItemId === 'avi-1')).toMatchObject({
      status: 'remote-only'
    })
  })
})
