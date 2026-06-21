import { describe, expect, it, vi } from 'vitest'
import { getCloudProviderAdapter } from '../cloud-provider'

vi.mock('../onedrive-connect', () => ({
  getConnectedOneDriveAccount: vi.fn(async () => ({ id: 'onedrive:account-1' })),
  importOneDriveFolder: vi.fn(async () => ({ connectionId: 'onedrive:account-1' })),
  refreshOneDriveFolder: vi.fn(async () => ({ connectionId: 'onedrive:account-1' })),
  listOneDriveFolders: vi.fn(async () => [])
}))

describe('cloud provider adapter', () => {
  it('exposes OneDrive through the shared cloud provider boundary', async () => {
    const adapter = getCloudProviderAdapter('onedrive')

    await expect(adapter.getConnectedAccount()).resolves.toMatchObject({
      id: 'onedrive:account-1'
    })
    await expect(adapter.listFolders('root')).resolves.toEqual([])
  })
})
