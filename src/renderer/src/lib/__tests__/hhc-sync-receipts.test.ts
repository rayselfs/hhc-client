import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSyncEntryByRemoteItem, putSyncEntry, resetSyncDBForTests } from '../sync-db'
import { retryHhcSyncReceipt } from '../hhc-sync-receipts'

async function seed(connection = 'hhc-line:user-1'): Promise<import('../sync-db').SyncEntryRecord> {
  return putSyncEntry({
    providerConnectionId: connection,
    remoteItemId: 'item-1',
    parentRemoteItemId: 'collection-1',
    kind: 'file',
    name: 'test',
    blobId: 'blob-1',
    etag: 'v1',
    status: 'available-offline',
    syncReceipt: {
      contentVersion: 'v1',
      appVersion: 'test',
      attempts: 0,
      nextRetryAt: 0,
      state: 'pending'
    }
  })
}

describe('HHC sync receipt retry', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(async () => {
    await resetSyncDBForTests()
  })

  it('persists retry state and acknowledges without downloading after a new provider cycle', async () => {
    const entry = await seed()
    const api = {
      recordSyncReceipt: vi
        .fn()
        .mockRejectedValueOnce(new TypeError('offline'))
        .mockResolvedValue(undefined)
    }
    await retryHhcSyncReceipt(api, entry.providerConnectionId, entry.remoteItemId, () => true)
    const pending = await getSyncEntryByRemoteItem(entry.providerConnectionId, entry.remoteItemId)
    expect(pending?.syncReceipt?.state).toBe('pending')
    expect(pending?.syncReceipt?.attempts).toBe(1)
    await retryHhcSyncReceipt(api, entry.providerConnectionId, entry.remoteItemId, () => true)
    expect(api.recordSyncReceipt).toHaveBeenCalledTimes(1)
    await retryHhcSyncReceipt(
      api,
      entry.providerConnectionId,
      entry.remoteItemId,
      () => true,
      pending!.syncReceipt!.nextRetryAt
    )
    expect(
      (await getSyncEntryByRemoteItem(entry.providerConnectionId, entry.remoteItemId))?.syncReceipt
        ?.state
    ).toBe('acknowledged')
    await retryHhcSyncReceipt(
      api,
      entry.providerConnectionId,
      entry.remoteItemId,
      () => true,
      Date.now() + 120_000
    )
    expect(api.recordSyncReceipt).toHaveBeenCalledTimes(2)
  })

  it('preserves acknowledgement through same-version refresh and clears it for replaced bytes', async () => {
    const entry = await seed()
    await retryHhcSyncReceipt(
      { recordSyncReceipt: async () => undefined },
      entry.providerConnectionId,
      entry.remoteItemId,
      () => true
    )
    const { syncReceipt: _receipt, ...refresh } = entry
    await putSyncEntry(refresh)
    expect(
      (await getSyncEntryByRemoteItem(entry.providerConnectionId, entry.remoteItemId))?.syncReceipt
        ?.state
    ).toBe('acknowledged')
    await putSyncEntry({ ...refresh, etag: 'v2' })
    expect(
      (await getSyncEntryByRemoteItem(entry.providerConnectionId, entry.remoteItemId))?.syncReceipt
    ).toBeUndefined()
  })

  it('does not send after root revocation and keeps account scopes separate', async () => {
    const first = await seed()
    const second = await seed('hhc-line:user-2')
    const api = { recordSyncReceipt: vi.fn(async () => undefined) }
    await retryHhcSyncReceipt(api, first.providerConnectionId, first.remoteItemId, () => false)
    expect(api.recordSyncReceipt).not.toHaveBeenCalled()
    await retryHhcSyncReceipt(api, second.providerConnectionId, second.remoteItemId, () => true)
    expect(
      (await getSyncEntryByRemoteItem(first.providerConnectionId, first.remoteItemId))?.syncReceipt
        ?.state
    ).toBe('pending')
    expect(
      (await getSyncEntryByRemoteItem(second.providerConnectionId, second.remoteItemId))
        ?.syncReceipt?.state
    ).toBe('acknowledged')
  })

  it('bounds a stalled receipt so subsequent sync can retry', async () => {
    const entry = await seed()
    vi.useFakeTimers()
    const api = {
      recordSyncReceipt: vi
        .fn()
        .mockImplementationOnce(() => new Promise(() => {}))
        .mockResolvedValue(undefined)
    }
    const first = retryHhcSyncReceipt(
      api,
      entry.providerConnectionId,
      entry.remoteItemId,
      () => true
    )
    await vi.waitFor(() => expect(api.recordSyncReceipt).toHaveBeenCalledOnce())
    const settled = vi.fn()
    void first.then(settled)
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.waitFor(() => expect(settled).toHaveBeenCalledOnce())
    vi.useRealTimers()
    const pending = await getSyncEntryByRemoteItem(entry.providerConnectionId, entry.remoteItemId)
    await retryHhcSyncReceipt(
      api,
      entry.providerConnectionId,
      entry.remoteItemId,
      () => true,
      pending!.syncReceipt!.nextRetryAt
    )
    expect(api.recordSyncReceipt).toHaveBeenCalledTimes(2)
  })

  it('stops retrying a terminal forbidden response', async () => {
    const entry = await seed()
    const api = {
      recordSyncReceipt: vi
        .fn()
        .mockRejectedValue({ classification: 'access-revoked', status: 403 })
    }
    await retryHhcSyncReceipt(api, entry.providerConnectionId, entry.remoteItemId, () => true)
    await retryHhcSyncReceipt(
      api,
      entry.providerConnectionId,
      entry.remoteItemId,
      () => true,
      Date.now() + 120_000
    )
    expect(api.recordSyncReceipt).toHaveBeenCalledTimes(1)
    expect(
      (await getSyncEntryByRemoteItem(entry.providerConnectionId, entry.remoteItemId))?.syncReceipt
        ?.state
    ).toBe('rejected')
  })
})
