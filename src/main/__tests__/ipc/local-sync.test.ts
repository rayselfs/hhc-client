import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleHandlers,
  mockShowOpenDialog,
  mockReadFile,
  mockWriteFile,
  mockRename,
  mockMkdir,
  mockRealpath,
  mockStat,
  mockReaddir
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockShowOpenDialog: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockMkdir: vi.fn(),
  mockRealpath: vi.fn(),
  mockStat: vi.fn(),
  mockReaddir: vi.fn()
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
    readdir: mockReaddir
  }
  return {
    default: { promises },
    promises
  }
})

import { BrowserWindow } from 'electron'
import type { WindowManager } from '../../windowManager'
import { registerLocalSyncHandlers } from '../../ipc/local-sync'

const wm = mockWindowManager as unknown as WindowManager
const CONNECTION_ID = '11111111-1111-4111-8111-111111111111'

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

beforeEach(() => {
  vi.clearAllMocks()
  handleHandlers.clear()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockReadFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
  mockRealpath.mockImplementation(async (value: string) => value)
  mockStat.mockResolvedValue({
    isDirectory: () => true,
    isFile: () => false,
    size: 100,
    mtimeMs: 1
  })
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
    mockReadFile.mockResolvedValue(
      JSON.stringify([
        {
          id: CONNECTION_ID,
          rootPath: '/Users/tester/Documents/Sermons',
          rootName: 'Sermons',
          displayName: 'Sermons',
          createdAt: 1,
          updatedAt: 1
        }
      ])
    )
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
    mockReadFile.mockResolvedValue(
      JSON.stringify([
        {
          id: CONNECTION_ID,
          rootPath: '/Volumes/Media/Sermons',
          rootName: 'Sermons',
          displayName: 'Sermons',
          createdAt: 1,
          updatedAt: 1
        }
      ])
    )
    mockReaddir.mockImplementation(async (path: string) => {
      if (path === '/Volumes/Media/Sermons') return [dir('Sunday'), file('intro.mp4')]
      if (path === '/Volumes/Media/Sermons/Sunday') return [file('message.mkv')]
      return []
    })
    mockStat.mockImplementation(async (path: string) => {
      if (path === '/Volumes/Media/Sermons') {
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
    expect(JSON.stringify(result)).not.toContain('/Volumes/Media/Sermons')
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
    mockReadFile.mockResolvedValue(
      JSON.stringify([
        {
          id: CONNECTION_ID,
          rootPath: '/Volumes/Media/Sermons',
          rootName: 'Sermons',
          displayName: 'Sermons',
          createdAt: 1,
          updatedAt: 1
        }
      ])
    )
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
    mockReadFile.mockResolvedValue(
      JSON.stringify([
        {
          id: CONNECTION_ID,
          rootPath: '/Volumes/Media/Sermons',
          rootName: 'Sermons',
          displayName: 'Sermons',
          createdAt: 1,
          updatedAt: 1
        }
      ])
    )
    mockReaddir.mockImplementation(async (path: string) => {
      if (path === '/Volumes/Media/Sermons') {
        return [
          dir('Readable'),
          dir('Private'),
          file('intro.mp4'),
          file('missing.mp4'),
          symlink('Link')
        ]
      }
      if (path === '/Volumes/Media/Sermons/Readable') return [file('message.mp4')]
      if (path === '/Volumes/Media/Sermons/Private') {
        throw Object.assign(new Error('denied'), { code: 'EACCES' })
      }
      return []
    })
    mockStat.mockImplementation(async (path: string) => {
      if (path === '/Volumes/Media/Sermons') {
        return { isDirectory: () => true, isFile: () => false, size: 0, mtimeMs: 1 }
      }
      if (path.endsWith('missing.mp4')) {
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
})
