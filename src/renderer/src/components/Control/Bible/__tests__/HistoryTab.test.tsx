import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { VerseItem } from '@shared/types/folder'
import { HistoryTab } from '../HistoryTab'

const mockNavigateTo = vi.fn()
const mockRemoveFromHistory = vi.fn()

const mockItem1: VerseItem = {
  id: 'item-1',
  type: 'verse',
  parentId: 'root',
  sortIndex: 0,
  versionId: 1,
  bookNumber: 1,
  chapter: 1,
  verse: 1,
  text: 'In the beginning God created the heavens and the earth.',
  createdAt: Date.now(),
  expiresAt: null
}

const mockItem2: VerseItem = {
  id: 'item-2',
  type: 'verse',
  parentId: 'root',
  sortIndex: 1,
  versionId: 1,
  bookNumber: 43,
  chapter: 3,
  verse: 16,
  text: 'For God so loved the world that he gave his one and only Son.',
  createdAt: Date.now(),
  expiresAt: null
}

const historySingleton = {
  items: [mockItem1, mockItem2],
  removeFromHistory: mockRemoveFromHistory
}

const bibleSingleton = {
  navigateTo: mockNavigateTo,
  versions: [{ id: 1, name: 'CUV' }]
}

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
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
  useBibleStore: Object.assign(
    (selector: (state: typeof bibleSingleton) => unknown) => selector(bibleSingleton),
    { getState: () => bibleSingleton }
  )
}))

vi.mock('@renderer/stores/bible-settings', () => ({
  useBibleSettingsStore: Object.assign(vi.fn(), {
    getState: () => ({ selectedVersionId: 1, setSelectedVersionId: vi.fn() })
  })
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
    expect(screen.getByText('約翰福音 3:16')).toBeInTheDocument()
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
    const item = screen.getByText('約翰福音 3:16').closest('button')!
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
