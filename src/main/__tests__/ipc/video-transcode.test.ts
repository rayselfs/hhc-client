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

function spawnPending(): ReturnType<typeof mockSpawn> & { kill: () => void } {
  const child = new EventEmitter() as ReturnType<typeof mockSpawn> & {
    stdout: EventEmitter
    stderr: EventEmitter
    kill: () => void
  }
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn(() => {
    process.nextTick(() => child.emit('close', 1))
    return true
  })
  return child
}

const storedConfig = JSON.stringify({
  executablePath: '/opt/homebrew/bin/ffmpeg',
  executableName: 'ffmpeg',
  version: '7.1',
  capabilities: {
    hasH264Encoder: true,
    hasAacEncoder: true,
    hasMp4Muxer: true
  },
  validatedAt: 1
})

beforeEach(() => {
  vi.clearAllMocks()
  handleHandlers.clear()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockRm.mockResolvedValue(undefined)
  mockAccess.mockResolvedValue(undefined)
  mockStat.mockResolvedValue({ isFile: () => true, size: 4096 })
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

  it('auto-detects command-line FFmpeg without storing a path', async () => {
    mockSpawn
      .mockImplementationOnce(() => spawnSuccess('ffmpeg version 7.1 Copyright'))
      .mockImplementationOnce(() =>
        spawnSuccess(' V..... libx264 H.264 encoder\n A..... aac AAC encoder')
      )
      .mockImplementationOnce(() => spawnSuccess(' E mp4 MP4 muxer'))

    await expect(
      getHandler('video-transcode:get-ffmpeg-config')(makeEvent())
    ).resolves.toMatchObject({
      status: 'ready',
      source: 'system',
      executableName: 'ffmpeg'
    })
    expect(mockWriteFile).not.toHaveBeenCalled()
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

  it('transcodes a managed native source to a temporary file before atomic rename', async () => {
    const sourceId = '123e4567-e89b-12d3-a456-426614174000'
    const outputId = '223e4567-e89b-12d3-a456-426614174000'
    mockReadFile.mockResolvedValue(storedConfig)
    mockSpawn
      .mockImplementationOnce(() => spawnSuccess('ffmpeg version 7.1 Copyright'))
      .mockImplementationOnce(() =>
        spawnSuccess(' V..... libx264 H.264 encoder\n A..... aac AAC encoder')
      )
      .mockImplementationOnce(() => spawnSuccess(' E mp4 MP4 muxer'))
      .mockImplementationOnce(() => spawnSuccess(''))

    const result = await getHandler('video-transcode:run')(makeEvent(), {
      jobId: 'job-1',
      sourceFileId: sourceId,
      outputFileId: outputId
    })

    expect(result).toEqual({ outputFileId: outputId, size: 4096 })
    const transcodeCall = mockSpawn.mock.calls.at(-1)!
    expect(transcodeCall[0]).toBe('/opt/homebrew/bin/ffmpeg')
    expect(transcodeCall[1]).toEqual(
      expect.arrayContaining([
        '-i',
        `/tmp/hhc-user-data/native-files/${sourceId}`,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-f',
        'mp4'
      ])
    )
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringMatching(/\/native-files\/\.223e4567-.+\.tmp\.mp4$/),
      `/tmp/hhc-user-data/native-files/${outputId}`
    )
  })

  it('rejects traversal output ids before spawning FFmpeg', async () => {
    await expect(
      getHandler('video-transcode:run')(makeEvent(), {
        jobId: 'job-1',
        sourceFileId: '123e4567-e89b-12d3-a456-426614174000',
        outputFileId: '../escaped'
      })
    ).rejects.toThrow('Invalid transcode output id')
    expect(mockSpawn).not.toHaveBeenCalled()
  })

  it('cancels an active transcode and removes its temporary output', async () => {
    const sourceId = '123e4567-e89b-12d3-a456-426614174000'
    const outputId = '223e4567-e89b-12d3-a456-426614174000'
    const child = spawnPending()
    mockReadFile.mockResolvedValue(storedConfig)
    mockSpawn
      .mockImplementationOnce(() => spawnSuccess('ffmpeg version 7.1 Copyright'))
      .mockImplementationOnce(() =>
        spawnSuccess(' V..... libx264 H.264 encoder\n A..... aac AAC encoder')
      )
      .mockImplementationOnce(() => spawnSuccess(' E mp4 MP4 muxer'))
      .mockImplementationOnce(() => child)

    const runPromise = getHandler('video-transcode:run')(makeEvent(), {
      jobId: 'job-1',
      sourceFileId: sourceId,
      outputFileId: outputId
    }) as Promise<unknown>
    await vi.waitFor(() => expect(mockSpawn).toHaveBeenCalledTimes(4))
    await getHandler('video-transcode:cancel')(makeEvent(), 'job-1')

    expect(child.kill).toHaveBeenCalled()
    expect(mockRm).toHaveBeenCalledWith(expect.stringMatching(/\.tmp\.mp4$/), { force: true })
    await expect(runPromise).rejects.toThrow()
  })

  it('generates a JPEG poster from a managed native source', async () => {
    const sourceId = '123e4567-e89b-12d3-a456-426614174000'
    mockReadFile
      .mockResolvedValueOnce(storedConfig)
      .mockResolvedValueOnce(Buffer.from('poster-bytes'))
    mockSpawn
      .mockImplementationOnce(() => spawnSuccess('ffmpeg version 7.1 Copyright'))
      .mockImplementationOnce(() =>
        spawnSuccess(' V..... libx264 H.264 encoder\n A..... aac AAC encoder')
      )
      .mockImplementationOnce(() => spawnSuccess(' E mp4 MP4 muxer'))
      .mockImplementationOnce(() => spawnSuccess(''))

    const result = await getHandler('video-transcode:generate-poster')(makeEvent(), {
      sourceFileId: sourceId
    })

    expect(result).toEqual({
      dataUrl: `data:image/jpeg;base64,${Buffer.from('poster-bytes').toString('base64')}`
    })
    const posterCall = mockSpawn.mock.calls.at(-1)!
    expect(posterCall[0]).toBe('/opt/homebrew/bin/ffmpeg')
    expect(posterCall[1]).toEqual(
      expect.arrayContaining([
        '-i',
        `/tmp/hhc-user-data/native-files/${sourceId}`,
        '-frames:v',
        '1'
      ])
    )
    expect(mockRm).toHaveBeenCalledWith(expect.stringMatching(/\.poster\.jpg$/), { force: true })
  })
})
