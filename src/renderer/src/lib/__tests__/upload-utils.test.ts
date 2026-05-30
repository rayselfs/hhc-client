import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadFiles, MAX_FILE_SIZE_WEB } from '../upload-utils'

// Mock modules
vi.mock('@heroui/react/toast', () => ({
  toast: { success: vi.fn(), danger: vi.fn(), warning: vi.fn() }
}))

vi.mock('@renderer/stores/file-explorer', () => ({
  addFileItemToStore: vi.fn(),
  useFileExplorerStore: { getState: vi.fn() }
}))

vi.mock('@renderer/lib/thumbnail-generator', () => ({
  generateThumbnail: vi.fn().mockResolvedValue(null)
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  saveThumbnail: vi.fn()
}))

vi.mock('@renderer/lib/env', () => ({
  isWeb: vi.fn()
}))

import { toast } from '@heroui/react/toast'
import { addFileItemToStore } from '@renderer/stores/file-explorer'
import { isWeb } from '@renderer/lib/env'

function makeFile(name: string, size: number, type = 'image/png'): File {
  const file = new File([], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(addFileItemToStore).mockResolvedValue('mock-id')
})

describe('uploadFiles — web mode size limit', () => {
  it('T1: web mode — file > 2GB is skipped, toast.danger called, addFileItemToStore NOT called', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const bigFile = makeFile('big.png', MAX_FILE_SIZE_WEB + 1)

    await uploadFiles([bigFile], 'parent-1')

    expect(toast.danger).toHaveBeenCalledWith('File "big.png" exceeds 2GB limit')
    expect(addFileItemToStore).not.toHaveBeenCalled()
  })

  it('T1: electron mode — file > 2GB NOT skipped, addFileItemToStore IS called', async () => {
    vi.mocked(isWeb).mockReturnValue(false)
    const bigFile = makeFile('big.png', MAX_FILE_SIZE_WEB + 1)

    await uploadFiles([bigFile], 'parent-1')

    expect(toast.danger).not.toHaveBeenCalled()
    expect(addFileItemToStore).toHaveBeenCalledWith(bigFile, 'parent-1')
  })

  it('T1: web mode — file < 2GB accepted, addFileItemToStore IS called', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const smallFile = makeFile('small.png', 1024)

    await uploadFiles([smallFile], 'parent-1')

    expect(toast.danger).not.toHaveBeenCalled()
    expect(addFileItemToStore).toHaveBeenCalledWith(smallFile, 'parent-1')
  })
})

describe('uploadFiles — concurrency semaphore', () => {
  it('T3: 10 files, max concurrent ≤ 3', async () => {
    vi.mocked(isWeb).mockReturnValue(false)

    let active = 0
    let maxActive = 0

    vi.mocked(addFileItemToStore).mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 50))
      active--
      return 'mock-id'
    })

    const files = Array.from({ length: 10 }, (_, i) => makeFile(`file${i}.txt`, 100, 'text/plain'))
    await uploadFiles(files, 'parent-1')

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(addFileItemToStore).toHaveBeenCalledTimes(10)
  })

  it('T3: concurrent uploadFiles calls share one global limit of 3', async () => {
    vi.mocked(isWeb).mockReturnValue(false)

    let active = 0
    let maxActive = 0

    vi.mocked(addFileItemToStore).mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 50))
      active--
      return 'mock-id'
    })

    const filesA = Array.from({ length: 3 }, (_, i) => makeFile(`a${i}.txt`, 100, 'text/plain'))
    const filesB = Array.from({ length: 3 }, (_, i) => makeFile(`b${i}.txt`, 100, 'text/plain'))

    await Promise.all([uploadFiles(filesA, 'parent-1'), uploadFiles(filesB, 'parent-2')])

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(addFileItemToStore).toHaveBeenCalledTimes(6)
  })

  it('T3: single file — completes successfully', async () => {
    vi.mocked(isWeb).mockReturnValue(false)
    const file = makeFile('single.png', 512)

    await uploadFiles([file], 'parent-1')

    expect(addFileItemToStore).toHaveBeenCalledTimes(1)
    expect(addFileItemToStore).toHaveBeenCalledWith(file, 'parent-1')
  })
})
