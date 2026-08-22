import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetMediaWorkDBForTests } from '../media-work-db'

const { mockAddFileItem, mockGenerateThumbnail, mockGeneratePdfPages, mockSavePdfPages } =
  vi.hoisted(() => ({
    mockAddFileItem: vi.fn(),
    mockGenerateThumbnail: vi.fn().mockResolvedValue(null),
    mockGeneratePdfPages: vi.fn(),
    mockSavePdfPages: vi.fn()
  }))

vi.mock('@renderer/stores/file-explorer', () => ({
  addFileItemToStore: mockAddFileItem,
  useFileExplorerStore: { getState: vi.fn() }
}))

vi.mock('@renderer/lib/thumbnail-generator', () => ({
  generateThumbnail: mockGenerateThumbnail,
  generateAllPdfPageThumbnails: mockGeneratePdfPages
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  saveThumbnail: vi.fn(),
  savePdfPageThumbs: mockSavePdfPages
}))

vi.mock('@renderer/lib/env', () => ({
  isWeb: () => false
}))

import { uploadFiles } from '../upload-utils'

describe('PDF page upload queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMediaWorkDBForTests()
  })

  it('renders multiple uploaded PDFs serially', async () => {
    const releases: Array<() => void> = []
    let active = 0
    let maxActive = 0
    mockAddFileItem.mockResolvedValueOnce('pdf-1').mockResolvedValueOnce('pdf-2')
    mockGeneratePdfPages.mockImplementation(async (_file, options) => {
      expect(options).toMatchObject({ throwOnError: true })
      expect(options.signal).toBeInstanceOf(AbortSignal)
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active--
      return ['data:image/jpeg;base64,cGFnZQ==']
    })

    await uploadFiles(
      [new File([], 'first.pdf', { type: '' }), new File([], 'second.pdf', { type: '' })],
      'parent-1'
    )

    await vi.waitFor(() => expect(mockGeneratePdfPages).toHaveBeenCalledTimes(1))
    releases.shift()?.()
    await vi.waitFor(() => expect(mockGeneratePdfPages).toHaveBeenCalledTimes(2))
    releases.shift()?.()
    await vi.waitFor(() => expect(mockSavePdfPages).toHaveBeenCalledTimes(2))
    expect(maxActive).toBe(1)
  })
})
