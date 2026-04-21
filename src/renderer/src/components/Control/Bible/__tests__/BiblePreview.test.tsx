import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRef } from 'react'
import type { BibleStore } from '@renderer/stores/bible'
import { BiblePreview } from '../BiblePreview'

const mockProject = vi.fn()
const mockClaimProjection = vi.fn()
const mockNavigateTo = vi.fn()
const mockNextChapter = vi.fn()
const mockPrevChapter = vi.fn()
const mockRetry = vi.fn()

const storeSingleton: BibleStore = {
  versions: [],
  content: new Map(),
  currentPassage: { bookNumber: 1, chapter: 1, verse: 1 },
  isLoading: false,
  loadingProgress: null,
  error: null,
  isInitialized: true,
  initialize: vi.fn(),
  fetchVersionContent: vi.fn(),
  navigateTo: mockNavigateTo,
  nextChapter: mockNextChapter,
  prevChapter: mockPrevChapter,
  nextVerse: vi.fn(),
  prevVerse: vi.fn(),
  retry: mockRetry,
  getCurrentBook: () => ({
    number: 1,
    code: 'GEN',
    name: '創世記',
    abbreviation: '創',
    chapters: []
  }),
  getCurrentChapter: () => ({ number: 1, verses: [] }),
  getCurrentVerses: () => [
    { id: 1, number: 1, text: 'In the beginning God created the heavens and the earth.' },
    { id: 2, number: 2, text: 'Now the earth was formless and empty.' }
  ]
}

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    isProjectionOpen: false,
    isProjectionBlanked: false,
    projectionReadyCount: 0,
    activeOwner: 'bible',
    claimProjection: mockClaimProjection,
    openProjection: vi.fn(),
    closeProjection: vi.fn(),
    blankProjection: vi.fn(),
    project: mockProject,
    send: vi.fn(),
    on: vi.fn()
  })
}))

vi.mock('@renderer/stores/bible-settings', () => ({
  useBibleSettingsStore: Object.assign(
    (selector?: (state: { fontSize: number }) => unknown) =>
      selector ? selector({ fontSize: 90 }) : { fontSize: 90 },
    { getState: () => ({ fontSize: 90, selectedVersionId: 'mock-version' }) }
  )
}))

vi.mock('@renderer/stores/bible', () => ({
  useBibleStore: Object.assign(
    (selector?: (state: BibleStore) => unknown) =>
      selector ? selector(storeSingleton) : storeSingleton,
    {
      getState: () => storeSingleton
    }
  )
}))

vi.mock('@renderer/stores/bible-search', () => ({
  useBibleSearchStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      isSearchMode: false,
      isSearching: false,
      isIndexReady: true,
      results: [],
      query: '',
      clearSearch: vi.fn()
    }
    return selector ? selector(state) : state
  }
}))

vi.mock('@renderer/stores/bible-history', () => ({
  useBibleHistoryStore: Object.assign(
    (selector?: (state: unknown) => unknown) => {
      const state = {
        items: [],
        addToHistory: vi.fn(),
        removeFromHistory: vi.fn(),
        clearHistory: vi.fn()
      }
      return selector ? selector(state) : state
    },
    {
      getState: () => ({
        items: [],
        addToHistory: vi.fn(),
        removeFromHistory: vi.fn(),
        clearHistory: vi.fn()
      })
    }
  )
}))

vi.mock('@renderer/lib/bible-utils', () => ({
  formatVerseReference: vi.fn(
    (_t: unknown, _bookNum: number, chapter: number, verse: number) =>
      `MockBook ${chapter}:${verse}`
  ),
  getBookConfig: (bookNumber: number) => ({
    number: bookNumber,
    code: bookNumber === 1 ? 'Gen' : 'Exo',
    chapterCount: bookNumber === 1 ? 50 : 40
  }),
  shouldShowChapterNumber: () => true,
  buildVerseHistoryItem: vi.fn(() => ({
    id: 'mock-verse-item',
    type: 'verse',
    parentId: '',
    sortIndex: 0,
    versionId: 1,
    bookNumber: 1,
    chapter: 1,
    verse: 1,
    text: '',
    createdAt: Date.now(),
    expiresAt: null
  }))
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'bible.books.gen.name': '創世記',
        'bible.chapterUnit.default': '章',
        'bible.chapterUnit.psa': '篇',
        'bible.preview.noContent': '尚未載入經文內容'
      }
      return map[key] ?? key
    }
  })
}))

function applyOverrides(overrides: Partial<BibleStore>): void {
  Object.assign(storeSingleton, overrides)
}

function renderBiblePreview(): ReturnType<typeof render> {
  function Wrapper(): React.JSX.Element {
    const scrollBehaviorRef = useRef<ScrollBehavior>('instant')
    return (
      <BiblePreview
        onContextMenu={vi.fn()}
        selectedVerseIndex={0}
        onSelectedVerseIndexChange={vi.fn()}
        scrollBehaviorRef={scrollBehaviorRef}
      />
    )
  }
  return render(<Wrapper />)
}

describe('BiblePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    Object.assign(storeSingleton, {
      isLoading: false,
      error: null,
      currentPassage: { bookNumber: 1, chapter: 1, verse: 1 },
      navigateTo: mockNavigateTo,
      nextChapter: mockNextChapter,
      prevChapter: mockPrevChapter,
      retry: mockRetry,
      getCurrentBook: () => ({
        number: 1,
        code: 'GEN',
        name: '創世記',
        abbreviation: '創',
        chapters: []
      }),
      getCurrentChapter: () => ({ number: 1, verses: [] }),
      getCurrentVerses: () => [
        { id: 1, number: 1, text: 'In the beginning God created the heavens and the earth.' },
        { id: 2, number: 2, text: 'Now the earth was formless and empty.' }
      ]
    })
  })

  it('renders verse list when content is loaded', () => {
    renderBiblePreview()
    expect(
      screen.getByText('In the beginning God created the heavens and the earth.')
    ).toBeInTheDocument()
    expect(screen.getByText('Now the earth was formless and empty.')).toBeInTheDocument()
  })

  it('shows book and chapter heading', () => {
    renderBiblePreview()
    expect(screen.getByText(/創世記/)).toBeInTheDocument()
  })

  it('clicking a verse calls claimProjection and project', () => {
    renderBiblePreview()
    const verseBtn = screen
      .getByText('In the beginning God created the heavens and the earth.')
      .closest('button')!
    fireEvent.click(verseBtn)
    expect(mockClaimProjection).toHaveBeenCalledWith('bible', { unblank: true })
    expect(mockProject).toHaveBeenCalledWith(
      'bible:chapter',
      expect.objectContaining({
        bookNumber: 1,
        chapter: 1,
        currentVerse: 1
      }),
      { autoOpen: true }
    )
  })

  it('clicking a verse calls navigateTo with correct passage', () => {
    renderBiblePreview()
    const verseBtn = screen
      .getByText('In the beginning God created the heavens and the earth.')
      .closest('button')!
    fireEvent.click(verseBtn)
    expect(mockNavigateTo).toHaveBeenCalledWith({ bookNumber: 1, chapter: 1, verse: 1 })
  })

  it('calls nextChapter when next chapter button pressed', () => {
    applyOverrides({
      currentPassage: { bookNumber: 2, chapter: 2, verse: 1 },
      getCurrentBook: () => ({
        number: 2,
        code: 'EXO',
        name: '出埃及記',
        abbreviation: '出',
        chapters: []
      }),
      getCurrentChapter: () => ({ number: 2, verses: [] })
    })
    renderBiblePreview()
    const buttons = screen.getAllByRole('button')
    const iconButtons = buttons.filter((b) => b.querySelector('svg'))
    fireEvent.click(iconButtons[1])
    expect(mockNextChapter).toHaveBeenCalled()
  })

  it('calls prevChapter when prev chapter button pressed', () => {
    applyOverrides({
      currentPassage: { bookNumber: 2, chapter: 2, verse: 1 },
      getCurrentBook: () => ({
        number: 2,
        code: 'EXO',
        name: '出埃及記',
        abbreviation: '出',
        chapters: []
      }),
      getCurrentChapter: () => ({ number: 2, verses: [] })
    })
    renderBiblePreview()
    const buttons = screen.getAllByRole('button')
    const iconButtons = buttons.filter((b) => b.querySelector('svg'))
    fireEvent.click(iconButtons[0])
    expect(mockPrevChapter).toHaveBeenCalled()
  })

  it('shows loading spinner when isLoading is true', () => {
    applyOverrides({ isLoading: true, getCurrentVerses: () => [] })
    renderBiblePreview()
    expect(
      screen.queryByText('In the beginning God created the heavens and the earth.')
    ).not.toBeInTheDocument()
  })

  it('shows empty state when no verses', () => {
    applyOverrides({ isLoading: false, error: null, getCurrentVerses: () => [] })
    renderBiblePreview()
    expect(screen.getByText('尚未載入經文內容')).toBeInTheDocument()
  })
})
