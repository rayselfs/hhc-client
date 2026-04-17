import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { VerseItem } from '@shared/types/folder'
import { HistoryTab } from '../HistoryTab'

const mockNavigateTo = vi.fn()
const mockRemoveFromHistory = vi.fn()

const mockItem1: VerseItem = {
  id: 'item-1',
  type: 'verse',
  folderId: 'root',
  bookCode: 'GEN',
  bookName: '創世記',
  bookNumber: 1,
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
  text: 'In the beginning God created the heavens and the earth.',
  versionCode: 'CUV',
  versionName: '和合本',
  createdAt: Date.now()
}

const mockItem2: VerseItem = {
  id: 'item-2',
  type: 'verse',
  folderId: 'root',
  bookCode: 'JHN',
  bookName: '約翰福音',
  bookNumber: 43,
  chapter: 3,
  verseStart: 16,
  verseEnd: 17,
  text: 'For God so loved the world that he gave his one and only Son.',
  versionCode: 'CUV',
  versionName: '和合本',
  createdAt: Date.now()
}

const historySingleton = {
  items: [mockItem1, mockItem2],
  removeFromHistory: mockRemoveFromHistory
}

const bibleSingleton = {
  navigateTo: mockNavigateTo
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | object) => {
      const bookMap: Record<string, string> = {
        'bible.books.gen.name': '創世記',
        'bible.books.joh.name': '約翰福音'
      }
      if (bookMap[key]) return bookMap[key]
      if (typeof defaultValue === 'string') return defaultValue
      if (typeof defaultValue === 'object' && defaultValue && 'defaultValue' in defaultValue)
        return (defaultValue as { defaultValue: string }).defaultValue
      return key
    }
  })
}))

vi.mock('@renderer/stores/bible-history', () => ({
  useBibleHistoryStore: Object.assign(
    (selector: (state: typeof historySingleton) => unknown) => selector(historySingleton),
    { getState: () => historySingleton }
  )
}))

vi.mock('@renderer/stores/bible', () => ({
  useBibleStore: (selector: (state: typeof bibleSingleton) => unknown) => selector(bibleSingleton)
}))

describe('HistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    historySingleton.items = [mockItem1, mockItem2]
    historySingleton.removeFromHistory = mockRemoveFromHistory
    bibleSingleton.navigateTo = mockNavigateTo
  })

  it('renders history items with references', () => {
    render(<HistoryTab />)
    expect(screen.getByText('創世記 1:1')).toBeInTheDocument()
    expect(screen.getByText('約翰福音 3:16-17')).toBeInTheDocument()
  })

  it('renders verse text preview', () => {
    render(<HistoryTab />)
    expect(
      screen.getByText('In the beginning God created the heavens and the earth.')
    ).toBeInTheDocument()
  })

  it('clicking history item calls navigateTo with correct passage', () => {
    render(<HistoryTab />)
    const item = screen.getByText('創世記 1:1').closest('button')!
    fireEvent.click(item)
    expect(mockNavigateTo).toHaveBeenCalledWith({
      bookNumber: 1,
      chapter: 1,
      verse: 1
    })
  })

  it('clicking second item navigates to correct passage', () => {
    render(<HistoryTab />)
    const item = screen.getByText('約翰福音 3:16-17').closest('button')!
    fireEvent.click(item)
    expect(mockNavigateTo).toHaveBeenCalledWith({
      bookNumber: 43,
      chapter: 3,
      verse: 16
    })
  })

  it('shows empty state when no history', () => {
    historySingleton.items = []
    render(<HistoryTab />)
    expect(screen.getByText('尚無瀏覽歷史')).toBeInTheDocument()
  })

  it('remove button calls removeFromHistory with item id', () => {
    render(<HistoryTab />)
    const removeButtons = screen
      .getAllByRole('button')
      .filter(
        (b) => b.querySelector('svg') && b !== screen.getByText('創世記 1:1').closest('button')
      )
    fireEvent.click(removeButtons[0])
    expect(mockRemoveFromHistory).toHaveBeenCalledWith('item-1')
  })

  it('truncates long verse text', () => {
    const longItem: VerseItem = {
      ...mockItem1,
      id: 'item-long',
      text: 'A'.repeat(100)
    }
    historySingleton.items = [longItem]
    render(<HistoryTab />)
    const truncated = screen.getByText(/^A+\.\.\./)
    expect(truncated).toBeInTheDocument()
    expect(truncated.textContent?.length).toBeLessThanOrEqual(63)
  })
})
