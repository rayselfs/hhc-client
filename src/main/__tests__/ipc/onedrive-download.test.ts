import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleHandlers,
  mockMkdir,
  mockOpen,
  mockRename,
  mockRm,
  mockStatfs,
  mockWrite,
  mockClose,
  mockFetch,
  mockSend
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockMkdir: vi.fn(),
  mockOpen: vi.fn(),
  mockRename: vi.fn(),
  mockRm: vi.fn(),
  mockStatfs: vi.fn(),
  mockWrite: vi.fn(),
  mockClose: vi.fn(),
  mockFetch: vi.fn(),
  mockSend: vi.fn()
}))

const mockMainWindow = { id: 1 }
const mockProjectionWindow = { id: 2 }
const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow)
}

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/hhc-user-data')
  },
  BrowserWindow: {
    fromWebContents: vi.fn()
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler)
    })
  },
  net: {
    fetch: mockFetch
  },
  protocol: {
    handle: vi.fn()
  }
}))

vi.mock('fs', () => {
  const promises = {
    mkdir: mockMkdir,
    open: mockOpen,
    rename: mockRename,
    rm: mockRm,
    statfs: mockStatfs
  }
  return { default: { promises }, promises }
})

import { BrowserWindow, net } from 'electron'
import type { WindowManager } from '../../windowManager'
import { registerOneDriveDownloadHandlers } from '../../ipc/onedrive-download'

const wm = mockWindowManager as unknown as WindowManager
const validFileId = '123e4567-e89b-12d3-a456-426614174000'

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: { send: mockSend } } as unknown as Electron.IpcMainInvokeEvent
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handler = handleHandlers.get(channel)
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
  return handler
}

beforeEach(() => {
  vi.clearAllMocks()
  handleHandlers.clear()
  mockMkdir.mockResolvedValue(undefined)
  mockWrite.mockResolvedValue(undefined)
  mockClose.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockRm.mockResolvedValue(undefined)
  mockStatfs.mockResolvedValue({ blocks: 100, bsize: 100, bavail: 90 })
  mockOpen.mockResolvedValue({ write: mockWrite, close: mockClose })
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
  registerOneDriveDownloadHandlers(wm)
})

describe('OneDrive native download IPC', () => {
  it('streams Graph content to a temporary file before atomic rename', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(new Blob(['video-bytes'], { type: 'video/mp4' }), {
        headers: { 'Content-Type': 'video/mp4' }
      })
    )

    const result = await getHandler('onedrive:download-file')(makeEvent(), {
      remoteItemId: 'remote-file-1',
      targetFileId: validFileId,
      accessToken: 'access-token',
      expectedSize: 13
    })

    expect(result).toEqual({ fileId: validFileId, size: 13, mimeType: 'video/mp4' })
    expect(net.fetch).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/drive/items/remote-file-1/content',
      {
        headers: { Authorization: 'Bearer access-token' }
      }
    )
    expect(mockWrite).toHaveBeenCalledWith(expect.any(Buffer))
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringContaining(`/native-files/${validFileId}.`),
      `/tmp/hhc-user-data/native-files/${validFileId}`
    )
  })

  it('sends progress events while streaming content', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(new Blob(['video-bytes'], { type: 'video/mp4' }), {
        headers: { 'Content-Type': 'video/mp4' }
      })
    )

    await getHandler('onedrive:download-file')(makeEvent(), {
      remoteItemId: 'remote-file-1',
      targetFileId: validFileId,
      accessToken: 'access-token',
      expectedSize: 13
    })

    expect(mockSend).toHaveBeenCalledWith('onedrive:download-progress', {
      targetFileId: validFileId,
      downloadedBytes: 13,
      downloadTotalBytes: 13
    })
  })

  it('rejects non-main window access', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    await expect(
      getHandler('onedrive:download-file')(makeEvent(), {
        remoteItemId: 'remote-file-1',
        targetFileId: validFileId,
        accessToken: 'access-token'
      })
    ).rejects.toThrow('Unauthorized OneDrive download access')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects invalid native target file ids before fetching', async () => {
    await expect(
      getHandler('onedrive:download-file')(makeEvent(), {
        remoteItemId: 'remote-file-1',
        targetFileId: '../escape',
        accessToken: 'access-token'
      })
    ).rejects.toThrow('Invalid native file id')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('removes the temporary file when streamed size does not match expectation', async () => {
    mockFetch.mockResolvedValueOnce(new Response(new Blob(['short'])))

    await expect(
      getHandler('onedrive:download-file')(makeEvent(), {
        remoteItemId: 'remote-file-1',
        targetFileId: validFileId,
        accessToken: 'access-token',
        expectedSize: 999
      })
    ).rejects.toThrow('OneDrive download size mismatch')

    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining(`/native-files/${validFileId}.`), {
      force: true
    })
    expect(mockRename).not.toHaveBeenCalled()
  })
})
