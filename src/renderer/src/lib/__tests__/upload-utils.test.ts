import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_FILE_SIZE_WEB,
  prepareUploadFilesForKind,
  uploadFiles,
  uploadFolderFiles,
  uploadFromDataTransfer
} from '../upload-utils'

vi.mock('@heroui/react/toast', () => ({
  toast: { success: vi.fn(), danger: vi.fn(), warning: vi.fn() }
}))

vi.mock('@renderer/stores/file-explorer', () => ({
  addFileItemToStore: vi.fn(),
  useFileExplorerStore: { getState: vi.fn() }
}))

vi.mock('@renderer/lib/thumbnail-generator', () => ({
  generateThumbnail: vi.fn().mockResolvedValue(null),
  generateAllPdfPageThumbnails: vi.fn().mockResolvedValue([])
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  saveThumbnail: vi.fn(),
  savePdfPageThumbs: vi.fn()
}))

vi.mock('@renderer/lib/env', () => ({
  isWeb: vi.fn()
}))

vi.mock('@renderer/lib/media-job-queue', () => ({
  mediaJobQueue: {
    registerExecutor: vi.fn(),
    enqueue: vi.fn().mockResolvedValue({ id: 'job-id' })
  }
}))

import { toast } from '@heroui/react/toast'
import { addFileItemToStore } from '@renderer/stores/file-explorer'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { isWeb } from '@renderer/lib/env'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'

function makeFile(name: string, size: number, type = 'image/png'): File {
  const file = new File([], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function setRelativePath(file: File, relativePath: string): File {
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

function setStorageEstimate(estimate?: StorageEstimate): void {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: estimate ? { estimate: vi.fn().mockResolvedValue(estimate) } : undefined
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(addFileItemToStore).mockResolvedValue('mock-id')
  vi.mocked(useFileExplorerStore.getState).mockReturnValue({
    addFolder: vi.fn(),
    getChildFolders: vi.fn(() => [])
  } as never)
  vi.mocked(mediaJobQueue.enqueue).mockResolvedValue({ id: 'job-id' } as never)
  setStorageEstimate()
})

describe('uploadFiles web preflight', () => {
  it('skips files over 2 GiB in Web mode', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const bigFile = makeFile('big.png', MAX_FILE_SIZE_WEB + 1)

    await expect(uploadFiles([bigFile], 'parent-1')).resolves.toBe(0)

    expect(toast.danger).toHaveBeenCalledWith('File "big.png" exceeds 2GB limit')
    expect(addFileItemToStore).not.toHaveBeenCalled()
  })

  it('accepts files over 2 GiB in Electron mode', async () => {
    vi.mocked(isWeb).mockReturnValue(false)
    const bigFile = makeFile('big.png', MAX_FILE_SIZE_WEB + 1)

    await expect(uploadFiles([bigFile], 'parent-1')).resolves.toBe(1)

    expect(toast.danger).not.toHaveBeenCalled()
    expect(addFileItemToStore).toHaveBeenCalledWith(bigFile, 'parent-1', 'image/png')
  })

  it('rejects a Web batch that clearly exceeds available quota', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    setStorageEstimate({ quota: 1000, usage: 900 })
    const files = [makeFile('a.png', 60), makeFile('b.png', 60)]

    await expect(uploadFiles(files, 'parent-1')).resolves.toBe(0)

    expect(toast.danger).toHaveBeenCalledWith('The selected files exceed available browser storage')
    expect(addFileItemToStore).not.toHaveBeenCalled()
  })

  it('rejects folder input before creating folders when quota is insufficient', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    setStorageEstimate({ quota: 1000, usage: 950 })
    const file = setRelativePath(makeFile('slide.png', 100), 'Sunday/slide.png')
    const addFolder = vi.fn()

    await expect(uploadFolderFiles([file], 'root', addFolder)).resolves.toBe(0)

    expect(addFolder).not.toHaveBeenCalled()
    expect(addFileItemToStore).not.toHaveBeenCalled()
  })

  it('auto-renames existing and same-batch folder conflicts', async () => {
    vi.mocked(isWeb).mockReturnValue(false)
    const addFolder = vi.fn((name: string) => `id-${name}`)
    vi.mocked(useFileExplorerStore.getState).mockReturnValue({
      addFolder,
      getChildFolders: vi.fn((parentId: string) =>
        parentId === 'root' ? [{ id: 'existing', name: 'Sunday', parentId: 'root' }] : []
      )
    } as never)
    const files = [
      setRelativePath(makeFile('a.png', 100), 'Sunday/a.png'),
      setRelativePath(makeFile('b.png', 100), 'sunday/b.png')
    ]

    await uploadFolderFiles(files, 'root', addFolder)

    expect(addFolder).toHaveBeenNthCalledWith(1, 'Sunday 2', 'root')
    expect(addFolder).toHaveBeenNthCalledWith(2, 'sunday 3', 'root')
  })

  it('applies the Web size limit to drag-and-drop entries', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const file = makeFile('big.png', MAX_FILE_SIZE_WEB + 1)
    const entry = {
      isFile: true,
      isDirectory: false,
      name: file.name,
      file: (resolve: (value: File) => void) => resolve(file)
    }
    const items = {
      0: { webkitGetAsEntry: () => entry },
      length: 1
    } as unknown as DataTransferItemList

    await expect(uploadFromDataTransfer(items, 'root')).resolves.toBe(0)

    expect(addFileItemToStore).not.toHaveBeenCalled()
  })

  it('accepts MKV as a Web video candidate', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const file = makeFile('message.mkv', 100, '')

    await expect(uploadFiles([file], 'parent-1')).resolves.toBe(1)

    expect(addFileItemToStore).toHaveBeenCalledWith(file, 'parent-1', 'video/x-matroska')
    expect(generateThumbnail).toHaveBeenCalledWith(file, 'video/x-matroska')
    expect(mediaJobQueue.enqueue).not.toHaveBeenCalled()
  })

  it('warns when unsupported files are skipped', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const supported = setRelativePath(makeFile('slide.png', 100), 'Sunday/slide.png')
    const unsupported = setRelativePath(makeFile('notes.txt', 100, ''), 'Sunday/notes.txt')

    await expect(uploadFolderFiles([supported, unsupported], 'root', vi.fn())).resolves.toBe(1)

    expect(toast.warning).toHaveBeenCalledWith('Skipped 1 unsupported file(s)')
  })

  it('does not accept PSD files through generic image MIME fallback', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const psd = makeFile('layout.psd', 100, 'image/vnd.adobe.photoshop')

    await expect(uploadFiles([psd], 'parent-1')).resolves.toBe(0)

    expect(addFileItemToStore).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith('Skipped 1 unsupported file(s)')
  })

  it('silently ignores folder system files', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const supported = setRelativePath(makeFile('movie.mkv', 100, ''), 'Sunday/movie.mkv')
    const systemFile = setRelativePath(makeFile('.DS_Store', 100, ''), 'Sunday/.DS_Store')
    const addFolder = vi.fn((name: string) => `id-${name}`)

    await expect(uploadFolderFiles([supported, systemFile], 'root', addFolder)).resolves.toBe(1)

    expect(addFileItemToStore).toHaveBeenCalledWith(supported, 'id-Sunday', 'video/x-matroska')
    expect(toast.warning).not.toHaveBeenCalled()
  })
})

describe('uploadFiles classification', () => {
  beforeEach(() => {
    vi.mocked(isWeb).mockReturnValue(false)
  })

  it.each([
    ['slides.PDF', 'application/pdf'],
    ['photo.PNG', 'image/png']
  ])('persists canonical MIME for empty-MIME %s', async (name, canonicalMimeType) => {
    const file = makeFile(name, 100, '')

    await uploadFiles([file], 'parent-1')

    expect(addFileItemToStore).toHaveBeenCalledWith(file, 'parent-1', canonicalMimeType)
    expect(generateThumbnail).toHaveBeenCalledWith(file, canonicalMimeType)
  })

  it('skips unsupported files', async () => {
    const file = makeFile('notes.txt', 100, '')

    await expect(uploadFiles([file], 'parent-1')).resolves.toBe(0)

    expect(addFileItemToStore).not.toHaveBeenCalled()
  })

  it('enqueues PDF page rendering with canonical identities', async () => {
    const file = makeFile('slides.PDF', 100, '')

    await uploadFiles([file], 'parent-1')

    expect(mediaJobQueue.enqueue).toHaveBeenCalledWith({
      type: 'pdf-pages',
      sourceBlobId: 'mock-id',
      itemId: 'mock-id',
      dedupeKey: 'pdf-pages:mock-id'
    })
  })

  it('accepts Electron desktop-video candidates and enqueues one poster job', async () => {
    const file = makeFile('message.MKV', 100, '')

    await expect(uploadFiles([file], 'parent-1')).resolves.toBe(1)

    expect(addFileItemToStore).toHaveBeenCalledWith(file, 'parent-1', 'video/x-matroska')
    expect(mediaJobQueue.enqueue).toHaveBeenCalledWith({
      type: 'video-poster',
      sourceBlobId: 'mock-id',
      itemId: 'mock-id',
      dedupeKey: 'video-poster:mock-id'
    })
  })

  it('uses poster jobs for Electron-native videos instead of browser thumbnails', async () => {
    const file = makeFile('movie.MP4', 100, '')

    await expect(uploadFiles([file], 'parent-1')).resolves.toBe(1)

    expect(addFileItemToStore).toHaveBeenCalledWith(file, 'parent-1', 'video/mp4')
    expect(generateThumbnail).not.toHaveBeenCalled()
    expect(mediaJobQueue.enqueue).toHaveBeenCalledWith({
      type: 'video-poster',
      sourceBlobId: 'mock-id',
      itemId: 'mock-id',
      dedupeKey: 'video-poster:mock-id'
    })
  })
})

describe('prepareUploadFilesForKind', () => {
  beforeEach(() => {
    vi.mocked(isWeb).mockReturnValue(false)
  })

  it('keeps only audio files when requested', async () => {
    const files = [
      new File(['x'], 'cue.mp3', { type: 'audio/mpeg' }),
      new File(['x'], 'slide.png', { type: 'image/png' })
    ]

    const candidates = await prepareUploadFilesForKind(files, 'audio')

    expect(candidates).toHaveLength(1)
    expect(candidates[0].file.name).toBe('cue.mp3')
    expect(candidates[0].classification.kind).toBe('audio')
  })
})

describe('uploadFiles web video thumbnails', () => {
  beforeEach(() => {
    vi.mocked(isWeb).mockReturnValue(true)
  })

  it('keeps browser-native video thumbnail generation in Web mode', async () => {
    const file = makeFile('movie.MP4', 100, '')

    await expect(uploadFiles([file], 'parent-1')).resolves.toBe(1)

    expect(addFileItemToStore).toHaveBeenCalledWith(file, 'parent-1', 'video/mp4')
    expect(generateThumbnail).toHaveBeenCalledWith(file, 'video/mp4')
    expect(mediaJobQueue.enqueue).not.toHaveBeenCalled()
  })
})

describe('uploadFiles concurrency', () => {
  it('limits shared upload work to 3 files', async () => {
    vi.mocked(isWeb).mockReturnValue(false)
    let active = 0
    let maxActive = 0

    vi.mocked(addFileItemToStore).mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 20))
      active--
      return crypto.randomUUID()
    })

    const filesA = Array.from({ length: 5 }, (_, index) => makeFile(`a${index}.png`, 100))
    const filesB = Array.from({ length: 5 }, (_, index) => makeFile(`b${index}.png`, 100))

    await Promise.all([uploadFiles(filesA, 'parent-1'), uploadFiles(filesB, 'parent-2')])

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(addFileItemToStore).toHaveBeenCalledTimes(10)
  })
})
