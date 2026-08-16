import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'

const {
  handleHandlers,
  protocolHandlers,
  mockStat,
  mockMkdir,
  mockCopyFile,
  mockRename,
  mockUnlink,
  mockCreateReadStream
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  protocolHandlers: new Map<string, (request: Request) => Promise<Response>>(),
  mockStat: vi.fn(),
  mockMkdir: vi.fn(),
  mockCopyFile: vi.fn(),
  mockRename: vi.fn(),
  mockUnlink: vi.fn(),
  mockCreateReadStream: vi.fn()
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
    default: { createReadStream: mockCreateReadStream, promises },
    createReadStream: mockCreateReadStream,
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
  protocol: {
    handle: vi.fn((scheme: string, handler: (request: Request) => Promise<Response>) => {
      protocolHandlers.set(scheme, handler)
    })
  }
}))

import { BrowserWindow } from 'electron'
import { Readable } from 'stream'
import type { WindowManager } from '../../windowManager'
import {
  getNativeFilePath,
  parseNativeMediaUrl,
  registerNativeMediaLease,
  registerNativeFsHandlers,
  registerNativeMediaProtocol,
  releaseNativeMediaLease
} from '../../ipc/native-fs'

const wm = mockWindowManager as unknown as WindowManager
const validId = '123e4567-e89b-12d3-a456-426614174000'
const nativeDir = path.resolve('/tmp/hhc-user-data', 'native-files')
const nativeFilePath = path.join(nativeDir, validId)

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
  mockCreateReadStream.mockReturnValue(Readable.from(['partial']))
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
      expect.stringContaining(path.join(nativeDir, `.${validId}.`))
    )
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringContaining(path.join(nativeDir, `.${validId}.`)),
      nativeFilePath
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

describe('native file availability', () => {
  it('reports whether a managed native file exists', async () => {
    mockStat.mockResolvedValueOnce({ isFile: () => true, size: 10 })
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    await expect(getHandler('native-fs:file-exists')(makeEvent(), validId)).resolves.toBe(true)
    expect(mockStat).toHaveBeenCalledWith(nativeFilePath)
  })

  it('returns false when a managed native file is missing', async () => {
    mockStat.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    await expect(getHandler('native-fs:file-exists')(makeEvent(), validId)).resolves.toBe(false)
  })

  it('rejects file availability checks from non-main windows', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    await expect(getHandler('native-fs:file-exists')(makeEvent(), validId)).rejects.toThrow(
      'Unauthorized native file stat'
    )
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

  it('streams the managed file with byte range response headers', async () => {
    mockStat.mockResolvedValueOnce({ isFile: () => true, size: 100 })
    const handler = protocolHandlers.get('hhc-media')
    const request = new Request(`hhc-media://file/${validId}?type=video%2Fmp4`, {
      headers: { Range: 'bytes=0-6' }
    })

    const response = await handler!(request)

    expect(mockCreateReadStream).toHaveBeenCalledWith(nativeFilePath, { start: 0, end: 6 })
    expect(response.status).toBe(206)
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.headers.get('Content-Length')).toBe('7')
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Range')).toBe('bytes 0-6/100')
  })

  it('streams the full managed file with seekable media headers', async () => {
    mockStat.mockResolvedValueOnce({ isFile: () => true, size: 100 })
    const handler = protocolHandlers.get('hhc-media')

    const response = await handler!(new Request(`hhc-media://file/${validId}?type=video%2Fmp4`))

    expect(mockCreateReadStream).toHaveBeenCalledWith(nativeFilePath, { start: 0, end: 99 })
    expect(response.status).toBe(200)
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.headers.get('Content-Length')).toBe('100')
    expect(response.headers.get('Content-Type')).toBe('video/mp4')
    expect(response.headers.get('Content-Range')).toBeNull()
  })

  it('streams and releases only opaque session media leases', async () => {
    const leasePath = '/tmp/hhc-user-data/hhc-asset-leases/content.bin'
    const lease = registerNativeMediaLease(leasePath, 'video/mp4', '"etag-1"')
    mockStat.mockResolvedValueOnce({ isFile: () => true, size: 100 })
    const handler = protocolHandlers.get('hhc-media')

    const response = await handler!(new Request(lease.url, { headers: { Range: 'bytes=-10' } }))

    expect(lease).toMatchObject({
      leaseId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      etag: '"etag-1"'
    })
    expect(lease.url).toMatch(/^hhc-media:\/\/lease\/[0-9a-f-]{36}\?type=video%2Fmp4$/)
    expect(mockCreateReadStream).toHaveBeenCalledWith(leasePath, { start: 90, end: 99 })
    expect(response.status).toBe(206)

    await releaseNativeMediaLease(lease.leaseId)
    expect(mockUnlink).toHaveBeenCalledWith(leasePath)
    const missing = await handler!(new Request(lease.url))
    expect(missing.status).toBe(404)
  })

  it('retains a lease until unlink succeeds so transient cleanup can retry', async () => {
    const leasePath = '/tmp/hhc-user-data/hhc-asset-leases/retry.bin'
    const lease = registerNativeMediaLease(leasePath, 'video/mp4', '"etag-1"')
    mockUnlink.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EBUSY' }))

    await expect(releaseNativeMediaLease(lease.leaseId)).rejects.toThrow('busy')
    await expect(releaseNativeMediaLease(lease.leaseId)).resolves.toBeUndefined()
    expect(mockUnlink).toHaveBeenCalledTimes(2)
  })

  it('returns 416 for invalid media byte ranges', async () => {
    mockStat.mockResolvedValueOnce({ isFile: () => true, size: 100 })
    const handler = protocolHandlers.get('hhc-media')
    const request = new Request(`hhc-media://file/${validId}?type=video%2Fmp4`, {
      headers: { Range: 'bytes=200-300' }
    })

    const response = await handler!(request)

    expect(response.status).toBe(416)
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
    expect(response.headers.get('Content-Range')).toBe('bytes */100')
    expect(mockCreateReadStream).not.toHaveBeenCalled()
  })

  it('rejects traversal before accessing the filesystem', async () => {
    const handler = protocolHandlers.get('hhc-media')
    const response = await handler!(new Request('hhc-media://file/..%2Fescape?type=video%2Fmp4'))

    expect(response.status).toBe(400)
    expect(mockCreateReadStream).not.toHaveBeenCalled()
  })

  it('returns 404 when the managed file cannot be read', async () => {
    mockStat.mockRejectedValueOnce(new Error('missing'))
    const handler = protocolHandlers.get('hhc-media')
    const response = await handler!(new Request(`hhc-media://file/${validId}?type=video%2Fmp4`))

    expect(response.status).toBe(404)
  })
})
