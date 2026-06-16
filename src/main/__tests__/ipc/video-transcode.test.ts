import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleHandlers,
  mockShowOpenDialog,
  mockReadFile,
  mockWriteFile,
  mockRename,
  mockMkdir,
  mockRm,
  mockRealpath,
  mockStat,
  mockAccess,
  mockSpawn
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockShowOpenDialog: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockMkdir: vi.fn(),
  mockRm: vi.fn(),
  mockRealpath: vi.fn(),
  mockStat: vi.fn(),
  mockAccess: vi.fn(),
  mockSpawn: vi.fn()
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
  dialog: {
    showOpenDialog: mockShowOpenDialog
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler)
    })
  }
}))

vi.mock('fs', () => {
  const promises = {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    rename: mockRename,
    mkdir: mockMkdir,
    rm: mockRm,
    realpath: mockRealpath,
    stat: mockStat,
    access: mockAccess
  }
  return {
    default: { constants: { X_OK: 1 }, promises },
    constants: { X_OK: 1 },
    promises
  }
})

vi.mock('child_process', () => ({
  default: { spawn: mockSpawn },
  spawn: mockSpawn
}))

import { BrowserWindow } from 'electron'
import type { WindowManager } from '../../windowManager'
import { registerVideoTranscodeHandlers } from '../../ipc/video-transcode'

const wm = mockWindowManager as unknown as WindowManager

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handler = handleHandlers.get(channel)
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
  return handler
}

function spawnSuccess(output: string): ReturnType<typeof mockSpawn> {
  const child = new EventEmitter() as ReturnType<typeof mockSpawn> & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: () => void
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn()
  process.nextTick(() => {
    child.stdout.emit('data', Buffer.from(output))
    child.emit('close', 0)
  })
  return child
}

beforeEach(() => {
  vi.clearAllMocks()
  handleHandlers.clear()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockRm.mockResolvedValue(undefined)
  mockAccess.mockResolvedValue(undefined)
  mockStat.mockResolvedValue({ isFile: () => true })
  mockRealpath.mockImplementation(async (value: string) => value)
  mockReadFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
  registerVideoTranscodeHandlers(wm)
})

describe('video transcode FFmpeg configuration IPC', () => {
  it('returns not configured without exposing a path', async () => {
    await expect(getHandler('video-transcode:get-ffmpeg-config')(makeEvent())).resolves.toEqual({
      status: 'not-configured'
    })
  })

  it('rejects non-main window access', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    await expect(getHandler('video-transcode:get-ffmpeg-config')(makeEvent())).rejects.toThrow(
      'Unauthorized FFmpeg configuration access'
    )
  })

  it('returns null when executable selection is cancelled', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })

    await expect(getHandler('video-transcode:select-ffmpeg')(makeEvent())).resolves.toBeNull()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('validates and stores a selected executable without returning the raw path', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/usr/local/bin/ffmpeg']
    })
    mockRealpath.mockResolvedValue('/opt/homebrew/bin/ffmpeg')
    mockSpawn
      .mockImplementationOnce(() => spawnSuccess('ffmpeg version 7.1 Copyright'))
      .mockImplementationOnce(() =>
        spawnSuccess(' V..... libx264 H.264 encoder\n A..... aac AAC encoder')
      )
      .mockImplementationOnce(() => spawnSuccess(' E mp4 MP4 muxer'))

    const result = await getHandler('video-transcode:select-ffmpeg')(makeEvent())

    expect(result).toMatchObject({
      status: 'ready',
      executableName: 'ffmpeg',
      version: '7.1',
      capabilities: {
        hasH264Encoder: true,
        hasAacEncoder: true,
        hasMp4Muxer: true
      }
    })
    expect(JSON.stringify(result)).not.toContain('/opt/homebrew/bin/ffmpeg')
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('ffmpeg-config.json.'),
      expect.stringContaining('/opt/homebrew/bin/ffmpeg'),
      'utf8'
    )
  })

  it('does not store an executable that is missing required capabilities', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/usr/local/bin/ffmpeg']
    })
    mockSpawn
      .mockImplementationOnce(() => spawnSuccess('ffmpeg version 7.1 Copyright'))
      .mockImplementationOnce(() => spawnSuccess(' A..... aac AAC encoder'))
      .mockImplementationOnce(() => spawnSuccess(' E mp4 MP4 muxer'))

    const result = await getHandler('video-transcode:select-ffmpeg')(makeEvent())

    expect(result).toMatchObject({
      status: 'invalid',
      capabilities: {
        hasH264Encoder: false,
        hasAacEncoder: true,
        hasMp4Muxer: true
      }
    })
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('removes the persisted configuration', async () => {
    await expect(getHandler('video-transcode:remove-ffmpeg-config')(makeEvent())).resolves.toEqual({
      status: 'not-configured'
    })
    expect(mockRm).toHaveBeenCalledWith('/tmp/hhc-user-data/ffmpeg-config.json', { force: true })
  })
})
