import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleHandlers,
  protocolHandlers,
  mockStat,
  mockMkdir,
  mockCopyFile,
  mockRename,
  mockUnlink
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  protocolHandlers: new Map<string, (request: Request) => Promise<Response>>(),
  mockStat: vi.fn(),
  mockMkdir: vi.fn(),
  mockCopyFile: vi.fn(),
  mockRename: vi.fn(),
  mockUnlink: vi.fn()
}))

const mockMainWindow = { id: 1 }
const mockProjectionWindow = { id: 2 }
const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow)
}

vi.mock('fs', () => {
  const promises = {
    stat: mockStat,
    mkdir: mockMkdir,
    copyFile: mockCopyFile,
    rename: mockRename,
    unlink: mockUnlink
  }
  return {
    default: { promises },
    promises
  }
})

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
    fetch: vi.fn()
  },
  protocol: {
    handle: vi.fn((scheme: string, handler: (request: Request) => Promise<Response>) => {
      protocolHandlers.set(scheme, handler)
    })
  }
}))

import { BrowserWindow, net } from 'electron'
import type { WindowManager } from '../../windowManager'
import {
  getNativeFilePath,
  parseNativeMediaUrl,
  registerNativeFsHandlers,
  registerNativeMediaProtocol
} from '../../ipc/native-fs'

const wm = mockWindowManager as unknown as WindowManager
const validId = '123e4567-e89b-12d3-a456-426614174000'

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handler = handleHandlers.get(channel)
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
  return handler
}

beforeEach(() => {
  vi.clearAllMocks()
  handleHandlers.clear()
  protocolHandlers.clear()
  mockMkdir.mockResolvedValue(undefined)
  mockCopyFile.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockUnlink.mockResolvedValue(undefined)
  registerNativeFsHandlers(wm)
})

describe('native file import', () => {
  it('copies a file larger than 2GB through a temporary file and atomic rename', async () => {
    const size = 3 * 1024 ** 3
    mockStat
      .mockResolvedValueOnce({ isFile: () => true, size })
      .mockResolvedValueOnce({ isFile: () => true, size })
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    const result = await getHandler('native-fs:import-file')(
      makeEvent(),
      validId,
      '/source/large-video.mp4'
    )

    expect(result).toEqual({ size })
    expect(mockCopyFile).toHaveBeenCalledWith(
      '/source/large-video.mp4',
      expect.stringMatching(/\/native-files\/\.123e4567-.+\.tmp$/)
    )
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringMatching(/\/native-files\/\.123e4567-.+\.tmp$/),
      `/tmp/hhc-user-data/native-files/${validId}`
    )
  })

  it('rejects imports from non-main windows', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    await expect(
      getHandler('native-fs:import-file')(makeEvent(), validId, '/source/file.mp4')
    ).rejects.toThrow('Unauthorized native file import')
    expect(mockCopyFile).not.toHaveBeenCalled()
  })

  it.each(['../escape', '/absolute/path', 'folder/file', 'not-a-uuid'])(
    'rejects invalid managed file id %s',
    async (id) => {
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

      await expect(
        getHandler('native-fs:import-file')(makeEvent(), id, '/source/file.mp4')
      ).rejects.toThrow('Invalid native file id')
    }
  )

  it('rejects relative source paths', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    await expect(
      getHandler('native-fs:import-file')(makeEvent(), validId, '../source/file.mp4')
    ).rejects.toThrow('Invalid native file source')
  })

  it('removes the temporary file when copying fails', async () => {
    mockStat.mockResolvedValueOnce({ isFile: () => true, size: 10 })
    mockCopyFile.mockRejectedValueOnce(new Error('copy failed'))
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    await expect(
      getHandler('native-fs:import-file')(makeEvent(), validId, '/source/file.mp4')
    ).rejects.toThrow('copy failed')
    expect(mockUnlink).toHaveBeenCalledWith(expect.stringMatching(/\.tmp$/))
    expect(mockRename).not.toHaveBeenCalled()
  })
})

describe('native media protocol', () => {
  beforeEach(() => {
    registerNativeMediaProtocol()
  })

  it('parses only controlled media URLs', () => {
    expect(parseNativeMediaUrl(`hhc-media://file/${validId}?type=video%2Fmp4`)).toEqual({
      id: validId,
      mimeType: 'video/mp4'
    })
    expect(parseNativeMediaUrl('hhc-media://file/..%2Fescape?type=video%2Fmp4')).toBeNull()
    expect(() => getNativeFilePath('../escape')).toThrow('Invalid native file id')
  })

  it('streams the managed file and forwards range headers', async () => {
    vi.mocked(net.fetch).mockResolvedValue(
      new Response('partial', {
        status: 206,
        headers: { 'Content-Range': 'bytes 0-6/100' }
      }) as never
    )
    const handler = protocolHandlers.get('hhc-media')
    const request = new Request(`hhc-media://file/${validId}?type=video%2Fmp4`, {
      headers: { Range: 'bytes=0-6' }
    })

    const response = await handler!(request)

    expect(net.fetch).toHaveBeenCalledWith(
      `file:///tmp/hhc-user-data/native-files/${validId}`,
      expect.objectContaining({ headers: request.headers })
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Range')).toBe('bytes 0-6/100')
  })

  it('rejects traversal before accessing the filesystem', async () => {
    const handler = protocolHandlers.get('hhc-media')
    const response = await handler!(new Request('hhc-media://file/..%2Fescape?type=video%2Fmp4'))

    expect(response.status).toBe(400)
    expect(net.fetch).not.toHaveBeenCalled()
  })

  it('returns 404 when the managed file cannot be read', async () => {
    vi.mocked(net.fetch).mockRejectedValueOnce(new Error('missing'))
    const handler = protocolHandlers.get('hhc-media')
    const response = await handler!(new Request(`hhc-media://file/${validId}?type=video%2Fmp4`))

    expect(response.status).toBe(404)
  })
})
