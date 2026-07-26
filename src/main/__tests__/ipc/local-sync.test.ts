import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'

const {
  handleHandlers,
  mockShowOpenDialog,
  mockReadFile,
  mockWriteFile,
  mockRename,
  mockMkdir,
  mockRealpath,
  mockStat,
  mockReaddir,
  mockWatch,
  mockCopyFile,
  mockUnlink
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockShowOpenDialog: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockMkdir: vi.fn(),
  mockRealpath: vi.fn(),
  mockStat: vi.fn(),
  mockReaddir: vi.fn(),
  mockWatch: vi.fn(),
  mockCopyFile: vi.fn(),
  mockUnlink: vi.fn()
}))

const mockMainWindow = { id: 1 }
const mockProjectionWindow = { id: 2 }
const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow)
}

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'home') return '/Users/tester'
      if (name === 'temp') return '/tmp'
      return '/tmp/hhc-user-data'
    })
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
    realpath: mockRealpath,
    stat: mockStat,
    readdir: mockReaddir,
    copyFile: mockCopyFile,
    unlink: mockUnlink
  }
  return {
    default: { promises, watch: mockWatch },
    promises,
    watch: mockWatch
  }
})

import { BrowserWindow } from 'electron'
import type { WindowManager } from '../../windowManager'
import { registerLocalSyncHandlers } from '../../ipc/local-sync'

const wm = mockWindowManager as unknown as WindowManager
const CONNECTION_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_FILE_ID = '123e4567-e89b-12d3-a456-426614174000'
const ROOT_PATH = path.resolve('/Volumes/Media/Sermons')
const NATIVE_DIR = path.resolve('/tmp/hhc-user-data', 'native-files')

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handler = handleHandlers.get(channel)
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
  return handler
}

function dir(name: string): {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
  isSymbolicLink: () => boolean
} {
  return {
    name,
    isDirectory: () => true,
    isFile: () => false,
    isSymbolicLink: () => false
  }
}

function file(name: string): {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
  isSymbolicLink: () => boolean
} {
  return {
    name,
    isDirectory: () => false,
    isFile: () => true,
    isSymbolicLink: () => false
  }
}

function symlink(name: string): {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
  isSymbolicLink: () => boolean
} {
  return {
    name,
    isDirectory: () => false,
    isFile: () => false,
    isSymbolicLink: () => true
  }
}

function storedConnectionJson(rootPath = ROOT_PATH): string {
  return JSON.stringify([
    {
      id: CONNECTION_ID,
      rootPath,
      rootName: 'Sermons',
      displayName: 'Sermons',
      createdAt: 1,
      updatedAt: 1
    }
  ])
}

function remoteId(relativePath: string): string {
  return Buffer.from(relativePath).toString('base64url')
}

function makeWatcher(): {
  watcher: {
    on: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }
  emitError: (error: NodeJS.ErrnoException) => void
} {
  const handlers = new Map<string, (error: NodeJS.ErrnoException) => void>()
  const watcher = {
    on: vi.fn((eventName: string, handler: (error: NodeJS.ErrnoException) => void) => {
      handlers.set(eventName, handler)
      return watcher
    }),
    close: vi.fn()
  }
  return {
    watcher,
    emitError: (error) => handlers.get('error')?.(error)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  handleHandlers.clear()
  vi.useRealTimers()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockCopyFile.mockResolvedValue(undefined)
  mockUnlink.mockResolvedValue(undefined)
  mockReadFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
  mockRealpath.mockImplementation(async (value: string) => value)
  mockStat.mockResolvedValue({
    isDirectory: () => true,
    isFile: () => false,
    size: 100,
    mtimeMs: 1
  })
  mockWatch.mockImplementation(() => makeWatcher().watcher)
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
  registerLocalSyncHandlers(wm)
})

describe('local sync IPC', () => {
  it('stores a selected directory and returns only sanitized connection info', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/tester/Documents/Sermons']
    })

    const result = await getHandler('local-sync:select-folder')(makeEvent())

    expect(result).toMatchObject({
      displayName: 'Sermons',
      rootName: 'Sermons'
    })
    expect(JSON.stringify(result)).not.toContain('/Users/tester/Documents/Sermons')
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('local-sync-connections.json.'),
      expect.stringContaining('/Users/tester/Documents/Sermons'),
      'utf8'
    )
  })

  it('rejects overlapping selected directories', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson('/Users/tester/Documents/Sermons'))
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/tester/Documents/Sermons/Archive']
    })

    await expect(getHandler('local-sync:select-folder')(makeEvent())).rejects.toThrow(
      'Local sync directory overlaps an existing connection'
    )
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('rejects non-main window access', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    await expect(getHandler('local-sync:list-folders')(makeEvent())).rejects.toThrow(
      'Unauthorized local sync access'
    )
  })

  it('scans a connected folder without returning absolute paths', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    mockReaddir.mockImplementation(async (filePath: string) => {
      if (filePath === ROOT_PATH) return [dir('Sunday'), file('intro.mp4')]
      if (filePath === path.join(ROOT_PATH, 'Sunday')) {
        return [file('message.mkv'), file('.DS_Store')]
      }
      return []
    })
    mockStat.mockImplementation(async (filePath: string) => {
      if (filePath === ROOT_PATH) {
        return { isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: 1 }
      }
      return { isDirectory: () => false, isFile: () => true, size: 2048, mtimeMs: 5 }
    })

    const result = await getHandler('local-sync:scan-folder')(makeEvent(), CONNECTION_ID)

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'folder', name: 'Sunday' }),
        expect.objectContaining({ kind: 'file', name: 'intro.mp4', size: 2048 }),
        expect.objectContaining({ kind: 'file', name: 'message.mkv', size: 2048 })
      ])
    )
    expect(JSON.stringify(result)).not.toContain(ROOT_PATH)
    expect(result).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: '.DS_Store' })])
    )
  })

  it('rejects invalid connection ids before reading stored local sync paths', async () => {
    await expect(getHandler('local-sync:scan-folder')(makeEvent(), '../escape')).rejects.toThrow(
      'Invalid local sync connection id'
    )
    await expect(
      getHandler('local-sync:disconnect-folder')(makeEvent(), 'not-a-uuid')
    ).rejects.toThrow('Invalid local sync connection id')
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it('rejects scans when the connected root is no longer a directory', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    mockStat.mockResolvedValueOnce({
      isDirectory: () => false,
      isFile: () => true,
      size: 0,
      mtimeMs: 1
    })

    await expect(getHandler('local-sync:scan-folder')(makeEvent(), CONNECTION_ID)).rejects.toThrow(
      'Local sync directory is unavailable'
    )
  })

  it('skips symlinks and unreadable descendants without aborting the scan', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    mockReaddir.mockImplementation(async (filePath: string) => {
      if (filePath === ROOT_PATH) {
        return [
          dir('Readable'),
          dir('Private'),
          file('intro.mp4'),
          file('missing.mp4'),
          symlink('Link')
        ]
      }
      if (filePath === path.join(ROOT_PATH, 'Readable')) return [file('message.mp4')]
      if (filePath === path.join(ROOT_PATH, 'Private')) {
        throw Object.assign(new Error('denied'), { code: 'EACCES' })
      }
      return []
    })
    mockStat.mockImplementation(async (filePath: string) => {
      if (filePath === ROOT_PATH) {
        return { isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: 1 }
      }
      if (filePath.endsWith('missing.mp4')) {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      }
      return { isDirectory: () => false, isFile: () => true, size: 2048, mtimeMs: 5 }
    })

    const result = await getHandler('local-sync:scan-folder')(makeEvent(), CONNECTION_ID)

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'folder', name: 'Readable' }),
        expect.objectContaining({ kind: 'folder', name: 'Private' }),
        expect.objectContaining({ kind: 'file', name: 'intro.mp4' }),
        expect.objectContaining({ kind: 'file', name: 'message.mp4' })
      ])
    )
    expect(result).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'missing.mp4' }),
        expect.objectContaining({ name: 'Link' })
      ])
    )
  })

  it('starts a recursive watcher without exposing the root path', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    const { watcher } = makeWatcher()
    mockWatch.mockReturnValueOnce(watcher)

    const result = await getHandler('local-sync:start-watch')(makeEvent(), CONNECTION_ID)

    expect(result).toMatchObject({
      connectionId: CONNECTION_ID,
      state: 'watching'
    })
    expect(JSON.stringify(result)).not.toContain('/Volumes/Media/Sermons')
    expect(mockWatch).toHaveBeenCalledWith(ROOT_PATH, { recursive: true }, expect.any(Function))
  })

  it('debounces watcher changes into a rescan status and clears it after scan', async () => {
    vi.useFakeTimers()
    mockReadFile.mockResolvedValue(storedConnectionJson())
    mockReaddir.mockResolvedValue([])
    const { watcher } = makeWatcher()
    const watchCallbacks: Array<(eventType: string) => void> = []
    mockWatch.mockImplementationOnce(
      (_path: string, _options: unknown, callback: (eventType: string) => void) => {
        watchCallbacks.push(callback)
        return watcher
      }
    )

    await getHandler('local-sync:start-watch')(makeEvent(), CONNECTION_ID)
    expect(watchCallbacks).toHaveLength(1)
    watchCallbacks[0]('rename')
    watchCallbacks[0]('change')
    expect(
      await getHandler('local-sync:get-watch-status')(makeEvent(), CONNECTION_ID)
    ).toMatchObject({
      state: 'watching'
    })

    await vi.advanceTimersByTimeAsync(500)
    expect(
      await getHandler('local-sync:get-watch-status')(makeEvent(), CONNECTION_ID)
    ).toMatchObject({
      state: 'rescan-needed',
      reason: 'change'
    })

    await getHandler('local-sync:scan-folder')(makeEvent(), CONNECTION_ID)
    expect(
      await getHandler('local-sync:get-watch-status')(makeEvent(), CONNECTION_ID)
    ).toMatchObject({
      state: 'watching'
    })
  })

  it('marks watcher limit errors as overflow rescan', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    const { watcher, emitError } = makeWatcher()
    mockWatch.mockReturnValueOnce(watcher)

    await getHandler('local-sync:start-watch')(makeEvent(), CONNECTION_ID)
    emitError(Object.assign(new Error('watch limit'), { code: 'ENOSPC' }))

    expect(
      await getHandler('local-sync:get-watch-status')(makeEvent(), CONNECTION_ID)
    ).toMatchObject({
      state: 'overflow-rescan',
      reason: 'overflow'
    })
  })

  it('stops and closes an active watcher', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    const { watcher } = makeWatcher()
    mockWatch.mockReturnValueOnce(watcher)

    await getHandler('local-sync:start-watch')(makeEvent(), CONNECTION_ID)
    const result = await getHandler('local-sync:stop-watch')(makeEvent(), CONNECTION_ID)

    expect(watcher.close).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ state: 'idle' })
  })

  it('scans files larger than 2 GiB as metadata without file content', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    mockReaddir.mockResolvedValue([file('archive.mov')])
    mockStat.mockImplementation(async (filePath: string) => {
      if (filePath === ROOT_PATH) {
        return { isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: 1 }
      }
      return { isDirectory: () => false, isFile: () => true, size: 3 * 1024 ** 3, mtimeMs: 10 }
    })

    const result = await getHandler('local-sync:scan-folder')(makeEvent(), CONNECTION_ID)

    expect(result).toEqual([
      expect.objectContaining({
        kind: 'file',
        name: 'archive.mov',
        size: 3 * 1024 ** 3,
        etag: `${10}:${3 * 1024 ** 3}`
      })
    ])
    expect(JSON.stringify(result)).not.toContain(path.join(ROOT_PATH, 'archive.mov'))
  })

  it('imports a connected file into native media storage without exposing source paths', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())
    mockStat.mockImplementation(async (filePath: string) => {
      if (filePath === ROOT_PATH) {
        return { isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: 1 }
      }
      return { isDirectory: () => false, isFile: () => true, size: 4096, mtimeMs: 10 }
    })

    const result = await getHandler('local-sync:import-file')(makeEvent(), {
      connectionId: CONNECTION_ID,
      remoteItemId: remoteId('Sunday/message.mkv'),
      targetFileId: TARGET_FILE_ID
    })

    expect(result).toEqual({ size: 4096 })
    expect(mockCopyFile).toHaveBeenCalledWith(
      path.join(ROOT_PATH, 'Sunday', 'message.mkv'),
      expect.stringContaining(path.join(NATIVE_DIR, `.${TARGET_FILE_ID}.`))
    )
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringContaining(path.join(NATIVE_DIR, `.${TARGET_FILE_ID}.`)),
      path.join(NATIVE_DIR, TARGET_FILE_ID)
    )
  })

  it('rejects encoded traversal when importing connected files', async () => {
    mockReadFile.mockResolvedValue(storedConnectionJson())

    await expect(
      getHandler('local-sync:import-file')(makeEvent(), {
        connectionId: CONNECTION_ID,
        remoteItemId: remoteId('../secret.mov'),
        targetFileId: TARGET_FILE_ID
      })
    ).rejects.toThrow('Invalid local sync remote item id')

    expect(mockCopyFile).not.toHaveBeenCalled()
  })
})
