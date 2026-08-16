import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  mockFetch,
  mockGetAccessToken,
  mockRefreshAccessToken,
  mockMkdir,
  mockOpen,
  mockRename,
  mockRm,
  mockWrite,
  mockClose,
  mockRegisterLease,
  mockReleaseLease
} = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockFetch: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockRefreshAccessToken: vi.fn(),
  mockMkdir: vi.fn(),
  mockOpen: vi.fn(),
  mockRename: vi.fn(),
  mockRm: vi.fn(),
  mockWrite: vi.fn(),
  mockClose: vi.fn(),
  mockRegisterLease: vi.fn(),
  mockReleaseLease: vi.fn()
}))

const mainWindow = { id: 1 }
const projectionWindow = { id: 2 }

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/hhc-user-data') },
  BrowserWindow: { fromWebContents: vi.fn(() => mainWindow) },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    })
  },
  net: { fetch: mockFetch }
}))

vi.mock('node:fs', () => {
  const promises = { mkdir: mockMkdir, open: mockOpen, rename: mockRename, rm: mockRm }
  return { default: { promises }, promises }
})

vi.mock('../../ipc/native-fs', () => ({
  getNativeFilePath: (id: string) => `/tmp/hhc-user-data/native-files/${id}`,
  registerNativeMediaLease: mockRegisterLease,
  releaseNativeMediaLease: mockReleaseLease
}))

import { BrowserWindow } from 'electron'
import type { HhcAuthService } from '../../ipc/hhc-auth'
import { registerHhcAssetHandlers } from '../../ipc/hhc-assets'
import type { WindowManager } from '../../windowManager'

const wm = { getMainWindow: vi.fn(() => mainWindow) } as unknown as WindowManager
const auth = {
  getAccessToken: mockGetAccessToken,
  refreshAccessToken: mockRefreshAccessToken
} as unknown as HhcAuthService

function event(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

function handler(channel: string): (...args: unknown[]) => unknown {
  const registered = handlers.get(channel)
  if (!registered) throw new Error(`Missing handler ${channel}`)
  return registered
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  handlers.clear()
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mainWindow as never)
  mockGetAccessToken.mockResolvedValue('token-1')
  mockRefreshAccessToken.mockResolvedValue('token-2')
  mockMkdir.mockResolvedValue(undefined)
  mockWrite.mockResolvedValue(undefined)
  mockClose.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockRm.mockResolvedValue(undefined)
  mockOpen.mockResolvedValue({ write: mockWrite, close: mockClose })
  mockRegisterLease.mockReturnValue({
    kind: 'native-lease',
    url: 'hhc-media://lease/123e4567-e89b-12d3-a456-426614174000?type=video%2Fmp4',
    leaseId: '123e4567-e89b-12d3-a456-426614174000',
    etag: '"etag-1"'
  })
  registerHhcAssetHandlers(wm, auth)
})

describe('HHC Asset IPC', () => {
  it('owns the exact public Gateway URLs and bearer identity in main', async () => {
    mockFetch
      .mockResolvedValueOnce(json({ collections: [], cursor: 'next', hasMore: true }))
      .mockResolvedValueOnce(
        json({
          collection: {
            id: 'collection_1',
            namespace: 'line.group.media-sync',
            name: 'Group',
            revision: 1,
            createdAt: '2026-08-17T00:00:00Z',
            updatedAt: '2026-08-17T00:00:00Z'
          },
          items: [],
          tombstones: [],
          cursor: 'revision_1',
          hasMore: false,
          reset: false
        })
      )

    await handler('hhc-assets:list-collections')(event(), 'cursor / 1')
    await handler('hhc-assets:get-collection-changes')(event(), {
      collectionId: 'collection_1',
      cursor: 'revision / 1'
    })

    expect(mockFetch.mock.calls.map(([url]) => String(url))).toEqual([
      'https://www.alive.org.tw/api/assets/collections?limit=500&cursor=cursor+%2F+1',
      'https://www.alive.org.tw/api/assets/collections/collection_1/changes?cursor=revision+%2F+1'
    ])
    for (const [, init] of mockFetch.mock.calls) {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-1')
    }
  })

  it('uses only exact item and ticket routes with encoded query-free opaque IDs', async () => {
    mockFetch
      .mockResolvedValueOnce(
        json({
          id: 'item_1',
          collectionId: 'collection_1',
          remoteItemId: 'source_1',
          displayName: 'photo.jpg',
          sourceRevision: 'sha256',
          createdRevision: 1,
          createdAt: '2026-08-17T00:00:00Z'
        })
      )
      .mockResolvedValueOnce(
        json(
          {
            contentUrl: '/api/assets/content?ticket=opaque-secret',
            expiresAt: '2026-08-17T01:00:00Z',
            etag: '"etag-1"'
          },
          201
        )
      )

    await handler('hhc-assets:get-collection-item')(event(), {
      collectionId: 'collection_1',
      itemId: 'item_1'
    })
    await handler('hhc-assets:issue-content-ticket')(event(), {
      collectionId: 'collection_1',
      itemId: 'item_1'
    })

    expect(mockFetch.mock.calls.map(([url]) => String(url))).toEqual([
      'https://www.alive.org.tw/api/assets/collections/collection_1/items/item_1',
      'https://www.alive.org.tw/api/assets/collections/collection_1/items/item_1/content-ticket'
    ])
    expect(mockFetch.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
  })

  it('refreshes once in main and maps a second 401 without looping', async () => {
    mockFetch.mockResolvedValue(json({}, 401))

    await expect(handler('hhc-assets:list-collections')(event())).rejects.toThrow(
      'HHC_ASSET_AUTH_REQUIRED'
    )
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    [403, 'HHC_ASSET_ACCESS_REVOKED'],
    [429, 'HHC_ASSET_RETRYABLE'],
    [503, 'HHC_ASSET_RETRYABLE']
  ] as const)('maps HTTP %s without exposing response bodies', async (status, code) => {
    mockFetch.mockResolvedValue(json({ ticket: 'must-not-leak' }, status))

    await expect(handler('hhc-assets:list-collections')(event())).rejects.toThrow(code)
  })

  it('rejects non-main senders and every renderer-supplied trust-boundary field', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(projectionWindow as never)
    await expect(handler('hhc-assets:list-collections')(event())).rejects.toThrow('Unauthorized')
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mainWindow as never)

    for (const field of ['token', 'userId', 'role', 'url', 'path']) {
      await expect(
        handler('hhc-assets:get-collection-item')(event(), {
          collectionId: 'collection_1',
          itemId: 'item_1',
          [field]: 'attacker-controlled'
        })
      ).rejects.toThrow('Invalid HHC Asset request')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    [{ collectionId: '../escape', itemId: 'item_1' }],
    [{ collectionId: 'collection_1', itemId: '%2F' }],
    [{ collectionId: 'collection_1', itemId: 'item_1', range: 'bytes=0-1,4-5' }]
  ])('rejects invalid opaque IDs and multi-range input', async (request) => {
    await expect(handler('hhc-assets:get-collection-item')(event(), request)).rejects.toThrow(
      'Invalid HHC Asset request'
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('streams authenticated content to an app-owned native file without renderer paths', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'video/mp4', 'content-length': '3', etag: '"etag-1"' }
      })
    )

    await expect(
      handler('hhc-assets:download-file')(event(), {
        collectionId: 'collection_1',
        itemId: 'item_1',
        rootRemoteFolderId: 'collection_1',
        targetFileId: '123e4567-e89b-12d3-a456-426614174000'
      })
    ).resolves.toEqual({
      fileId: '123e4567-e89b-12d3-a456-426614174000',
      size: 3,
      mimeType: 'video/mp4'
    })
    expect(mockWrite).toHaveBeenCalledWith(expect.any(Buffer))
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringMatching(/\.tmp$/),
      '/tmp/hhc-user-data/native-files/123e4567-e89b-12d3-a456-426614174000'
    )
  })

  it('creates and releases an opaque session lease and bounds declared response size', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'content-type': 'video/mp4', 'content-length': '3', etag: '"etag-1"' }
      })
    )
    await expect(
      handler('hhc-assets:create-content-lease')(event(), {
        collectionId: 'collection_1',
        itemId: 'item_1'
      })
    ).resolves.toMatchObject({ kind: 'native-lease', etag: '"etag-1"' })
    expect(mockRegisterLease).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/hhc-user-data/hhc-asset-leases/'),
      'video/mp4',
      '"etag-1"'
    )

    await handler('hhc-assets:release-content-lease')(
      event(),
      '123e4567-e89b-12d3-a456-426614174000'
    )
    expect(mockReleaseLease).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')

    mockFetch.mockResolvedValueOnce(
      new Response(null, { headers: { 'content-length': String(209_715_201) } })
    )
    await expect(
      handler('hhc-assets:create-content-lease')(event(), {
        collectionId: 'collection_1',
        itemId: 'item_1'
      })
    ).rejects.toThrow('HHC_ASSET_FATAL')
  })
})
