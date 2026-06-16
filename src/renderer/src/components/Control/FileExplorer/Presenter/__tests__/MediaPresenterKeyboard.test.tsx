import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaPresenter from '../MediaPresenter'
import type { ShortcutHandler } from '@renderer/hooks/useKeyboardShortcuts'
import type { FileItemRecord } from '@shared/types/folder'

const {
  mockShortcuts,
  mockNext,
  mockPrev,
  mockExit,
  mockResetZoom,
  mockToggleGrid,
  mockSend,
  mockClaimProjection,
  mockBlankProjection,
  mockPauseTimer,
  storeState
} = vi.hoisted(() => {
  const videoItem: FileItemRecord = {
    id: 'video-1',
    parentId: 'root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'clip.mp4',
    url: 'blob:video-1',
    size: 10,
    mimeType: 'video/mp4'
  }
  return {
    mockShortcuts: [] as ShortcutHandler[],
    mockNext: vi.fn(),
    mockPrev: vi.fn(),
    mockExit: vi.fn(),
    mockResetZoom: vi.fn(),
    mockToggleGrid: vi.fn(),
    mockSend: vi.fn(),
    mockClaimProjection: vi.fn(),
    mockBlankProjection: vi.fn(),
    mockPauseTimer: vi.fn(),
    storeState: {
      playlist: [videoItem],
      showGrid: false,
      zoomLevel: 1,
      isEnded: false,
      typeStates: {
        video: { hasStarted: false, isPlaying: false, isEnded: false },
        pdf: { viewMode: 'slide' as const }
      },
      currentItem: () => videoItem,
      exit: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
      jumpTo: vi.fn(),
      toggleGrid: vi.fn(),
      setZoomLevel: vi.fn(),
      resetZoom: vi.fn()
    }
  }
})

vi.mock('@renderer/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (shortcuts: ShortcutHandler[]) => {
    mockShortcuts.length = 0
    mockShortcuts.push(...shortcuts)
  }
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    claimProjection: mockClaimProjection,
    blankProjection: mockBlankProjection,
    send: mockSend
  })
}))

vi.mock('@renderer/stores/timer-runtime', () => ({
  useTimerRuntimeStore: {
    getState: () => ({ status: 'idle', pause: mockPauseTimer })
  }
}))

vi.mock('@renderer/stores/media-projection', () => ({
  useMediaProjectionStore: Object.assign(
    vi.fn((selector: (state: typeof storeState) => unknown) => selector(storeState)),
    {
      getState: () => ({
        ...storeState,
        next: mockNext,
        prev: mockPrev,
        exit: mockExit,
        resetZoom: mockResetZoom,
        toggleGrid: mockToggleGrid
      })
    }
  )
}))

vi.mock('@renderer/lib/media-projection-sync', () => ({
  useMediaProjectionSync: vi.fn()
}))

vi.mock('@renderer/lib/shortcut-registry', () => ({
  setPresenterActive: vi.fn()
}))

vi.mock('@renderer/hooks/usePreviewCache', () => ({
  usePreviewCache: () => ({ pdfPageThumbs: {} })
}))

vi.mock('@renderer/hooks/useThumbnails', () => ({
  useThumbnails: () => ({})
}))

vi.mock('../PresenterHeader', () => ({
  default: () => <div />
}))
vi.mock('../PresenterNavigation', () => ({
  default: () => <div />
}))
vi.mock('../PresenterSidebar', () => ({
  default: () => <div />
}))
vi.mock('../PresenterGrid', () => ({
  default: () => <div />
}))
vi.mock('../Preview/MediaPreview', () => ({
  default: () => <div />
}))
vi.mock('../MediaToolbar', () => ({
  default: () => <div />
}))
vi.mock('@renderer/components/Common/GlassDivider', () => ({
  default: () => <div />
}))

function findShortcut(code: string): ShortcutHandler {
  const shortcut = mockShortcuts.find((item) => item.config.code === code)
  if (!shortcut) throw new Error(`Missing shortcut ${code}`)
  return shortcut
}

beforeEach(() => {
  vi.clearAllMocks()
  mockShortcuts.length = 0
  storeState.showGrid = false
  storeState.zoomLevel = 1
  storeState.typeStates.video = { hasStarted: false, isPlaying: false, isEnded: false }
})

describe('MediaPresenter video keyboard behavior', () => {
  it('uses item navigation before video playback starts', () => {
    render(<MediaPresenter />)

    findShortcut('ArrowRight').handler(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    findShortcut('ArrowLeft').handler(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))

    expect(mockNext).toHaveBeenCalledOnce()
    expect(mockPrev).toHaveBeenCalledOnce()
  })

  it('seeks left and right only while video has started and is not ended', () => {
    storeState.typeStates.video = { hasStarted: true, isPlaying: true, isEnded: false }
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<MediaPresenter />)

    findShortcut('ArrowRight').handler(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    findShortcut('ArrowLeft').handler(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockPrev).not.toHaveBeenCalled()
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'media:videoSeekRelative' })
    )
    dispatchSpy.mockRestore()
  })

  it('reads the latest video state during keydown even before rerendered shortcuts refresh', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<MediaPresenter />)

    storeState.typeStates.video = { hasStarted: true, isPlaying: true, isEnded: false }

    findShortcut('ArrowRight').handler(new KeyboardEvent('keydown', { code: 'ArrowRight' }))

    expect(mockNext).not.toHaveBeenCalled()
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'media:videoSeekRelative' })
    )
    dispatchSpy.mockRestore()
  })

  it('uses item navigation after video playback has ended', () => {
    storeState.typeStates.video = { hasStarted: true, isPlaying: false, isEnded: true }
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<MediaPresenter />)

    findShortcut('ArrowRight').handler(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    findShortcut('ArrowLeft').handler(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))

    expect(mockNext).toHaveBeenCalledOnce()
    expect(mockPrev).toHaveBeenCalledOnce()
    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'media:videoSeekRelative' })
    )
    dispatchSpy.mockRestore()
  })

  it('pauses the video on Escape only when video is playing', () => {
    storeState.typeStates.video = { hasStarted: true, isPlaying: true, isEnded: false }
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<MediaPresenter />)

    findShortcut('Escape').handler(new KeyboardEvent('keydown', { code: 'Escape' }))

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'media:pauseVideo' }))
    expect(mockExit).not.toHaveBeenCalled()
    dispatchSpy.mockRestore()
  })
})
