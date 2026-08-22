import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteWebOneDriveCredentials,
  getWebOneDriveAccessToken,
  saveWebOneDriveCredentials
} from '../onedrive-web-credentials'

beforeEach(async () => {
  vi.clearAllMocks()
  await deleteWebOneDriveCredentials('onedrive:account-1')
})

describe('web OneDrive credentials', () => {
  it('returns a stored access token when it is still valid', async () => {
    await saveWebOneDriveCredentials({
      connectionId: 'onedrive:account-1',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 300_000,
      scope: 'offline_access User.Read Files.Read',
      tokenType: 'Bearer'
    })

    await expect(
      getWebOneDriveAccessToken({
        connectionId: 'onedrive:account-1',
        clientId: '11111111-2222-3333-4444-555555555555'
      })
    ).resolves.toBe('access-token')
  })

  it('refreshes and stores a new access token before returning it', async () => {
    await saveWebOneDriveCredentials({
      connectionId: 'onedrive:account-1',
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresAt: Date.now() - 1000,
      tokenType: 'Bearer'
    })
    global.fetch = vi.fn(async () =>
      Response.json({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    )

    await expect(
      getWebOneDriveAccessToken({
        connectionId: 'onedrive:account-1',
        clientId: '11111111-2222-3333-4444-555555555555'
      })
    ).resolves.toBe('new-access-token')
    expect(fetch).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      expect.any(Object)
    )
  })
})
