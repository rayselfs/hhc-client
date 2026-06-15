import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import ImagePreview from '../ImagePreview'
import VideoPreview from '../VideoPreview'

const { mockGetFileSource, mockNext, mockExit, mockT } = vi.hoisted(() => ({
  mockGetFileSource: vi.fn(),
  mockNext: vi.fn(),
  mockExit: vi.fn(),
  mockT: (key: string) => key
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT })
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { warning: vi.fn() }
}))

vi.mock('@renderer/lib/file-explorer-db', () => ({
  openFileExplorerDB: vi.fn().mockResolvedValue({}),
  getFileSource: mockGetFileSource
}))

vi.mock('@renderer/contexts/PresenterCommandContext', () => ({
  usePresenterCommands: () => ({ sendCommand: vi.fn() })
}))

const storeState = {
  zoomLevel: 1,
  pan: { x: 0, y: 0 },
  next: mockNext,
  exit: mockExit,
  canNext: () => true
}

vi.mock('@renderer/stores/media-projection', () => ({
  useMediaProjectionStore: Object.assign(
    vi.fn((selector: (state: typeof storeState) => unknown) => selector(storeState)),
    { getState: () => storeState }
  )
}))

function makeCopy(mimeType: string, name: string): FileItemRecord {
  return {
    id: 'copy-id',
    parentId: 'folder-id',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name,
    url: 'blob:original-id',
    size: 1,
    mimeType
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetFileSource.mockResolvedValue({
    url: 'blob:resolved-source',
    revoke: vi.fn()
  })
  HTMLMediaElement.prototype.pause = vi.fn()
})

describe('copied media preview identity', () => {
  it('loads a copied image by its original blob identity', async () => {
    render(<ImagePreview item={makeCopy('image/png', 'copy.png')} />)

    await waitFor(() => {
      expect(mockGetFileSource).toHaveBeenCalledWith({}, 'original-id', 'image/png')
    })
    expect(screen.getByAltText('copy.png')).toHaveAttribute('src', 'blob:resolved-source')
  })

  it('loads a copied video by its original blob identity', async () => {
    const { container } = render(<VideoPreview item={makeCopy('video/mp4', 'copy.mp4')} />)

    await waitFor(() => {
      expect(mockGetFileSource).toHaveBeenCalledWith({}, 'original-id', 'video/mp4')
    })
    expect(container.querySelector('video')).toHaveAttribute('src', 'blob:resolved-source')
  })

  it('keeps the presenter open and retries a failed media load', async () => {
    mockGetFileSource.mockResolvedValueOnce(null).mockResolvedValueOnce({
      url: 'blob:retry-source',
      revoke: vi.fn()
    })
    render(<ImagePreview item={makeCopy('image/png', 'copy.png')} />)

    const retry = await screen.findByRole('button', { name: 'presenter.retry' })
    expect(mockNext).not.toHaveBeenCalled()
    expect(mockExit).not.toHaveBeenCalled()

    fireEvent.click(retry)

    await waitFor(() => {
      expect(mockGetFileSource).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByAltText('copy.png')).toHaveAttribute('src', 'blob:retry-source')
  })
})
