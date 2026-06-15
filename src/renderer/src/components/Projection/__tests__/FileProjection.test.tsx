import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileProjection from '../FileProjection'

const { mockGetFileSource } = vi.hoisted(() => ({
  mockGetFileSource: vi.fn()
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn().mockResolvedValue({}),
  getFileSource: mockGetFileSource
}))

vi.mock('@renderer/lib/projection-adapter', () => ({
  createProjectionAdapter: () => ({
    on: vi.fn(() => vi.fn()),
    dispose: vi.fn()
  })
}))

describe('FileProjection copied media identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFileSource.mockResolvedValue({
      url: 'blob:projection-source',
      revoke: vi.fn()
    })
  })

  it('loads projection content with blobId while retaining itemId as UI identity', async () => {
    const { getByAltText } = render(
      <FileProjection
        fileName="copy.png"
        initialItemId="copy-id"
        initialBlobId="original-id"
        initialMimeType="image/png"
      />
    )

    await waitFor(() => {
      expect(mockGetFileSource).toHaveBeenCalledWith({}, 'original-id', 'image/png')
    })
    expect(getByAltText('copy.png')).toHaveAttribute('src', 'blob:projection-source')
  })
})
