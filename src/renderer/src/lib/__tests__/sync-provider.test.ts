import { describe, expect, it, vi } from 'vitest'
import {
  assertProviderDoesNotExposeWriteOperations,
  isEntryAvailableOffline,
  type ReadOnlySyncProvider
} from '../sync-provider'

describe('sync-provider contract', () => {
  const provider: ReadOnlySyncProvider = {
    providerType: 'onedrive',
    connect: vi.fn(),
    disconnect: vi.fn(),
    initialScan: vi.fn(),
    incrementalChanges: vi.fn(),
    getMetadata: vi.fn(),
    downloadContent: vi.fn(),
    classifyError: () => 'fatal'
  }

  it('does not expose remote write operations', () => {
    expect(() => assertProviderDoesNotExposeWriteOperations(provider)).not.toThrow()
    expect(() =>
      assertProviderDoesNotExposeWriteOperations({
        ...provider,
        upload: vi.fn()
      } as ReadOnlySyncProvider)
    ).toThrow('Read-only sync provider exposes upload')
  })

  it('treats offline availability as a local blob state', () => {
    expect(
      isEntryAvailableOffline({
        id: 'entry-1',
        providerConnectionId: 'connection-1',
        remoteItemId: 'remote-1',
        parentRemoteItemId: null,
        kind: 'file',
        name: 'clip.mp4',
        blobId: 'blob-1',
        status: 'available-offline',
        createdAt: 1,
        updatedAt: 1
      })
    ).toBe(true)
    expect(
      isEntryAvailableOffline({
        id: 'entry-1',
        providerConnectionId: 'connection-1',
        remoteItemId: 'remote-1',
        parentRemoteItemId: null,
        kind: 'file',
        name: 'clip.mp4',
        status: 'remote-only',
        createdAt: 1,
        updatedAt: 1
      })
    ).toBe(false)
  })
})
