import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BibleSearchBar from '../BibleSearchBar'

const { mockInit, mockBuildIndex, mockSearch, mockNavigateTo } = vi.hoisted(() => ({
  mockInit: vi.fn().mockResolvedValue(undefined),
  mockBuildIndex: vi.fn().mockResolvedValue(undefined),
  mockSearch: vi.fn().mockResolvedValue([]),
  mockNavigateTo: vi.fn()
}))

const bibleSingleton = {
  versions: [{ id: 'cuv', code: 'CUV', name: '和合本', updatedAt: '' }],
  content: new Map() as Map<string, unknown[]>
}

vi.mock('@renderer/stores/bible', () => ({
  useBibleStore: Object.assign(
    (selector: (state: typeof bibleSingleton) => unknown) => selector(bibleSingleton),
    {
      getState: () => ({ navigateTo: mockNavigateTo })
    }
  )
}))

vi.mock('@renderer/lib/bible-search', () => ({
  BibleSearchEngine: class {
    init = mockInit
    buildIndex = mockBuildIndex
    search = mockSearch
  }
}))

describe('BibleSearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bibleSingleton.versions = [{ id: 'cuv', code: 'CUV', name: '和合本', updatedAt: '' }]
    bibleSingleton.content = new Map()
    mockSearch.mockResolvedValue([])
  })

  it('renders the search toggle button collapsed by default', () => {
    render(<BibleSearchBar />)
    const toggle = screen.getByRole('button', { name: '搜尋經文' })
    expect(toggle).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('搜尋經文...')).not.toBeInTheDocument()
  })

  it('clicking toggle expands the search bar', async () => {
    render(<BibleSearchBar />)
    const toggle = screen.getByRole('button', { name: '搜尋經文' })
    await act(async () => {
      fireEvent.click(toggle)
    })
    expect(screen.getByPlaceholderText('搜尋經文...')).toBeInTheDocument()
  })

  it('clicking toggle again collapses the search bar', async () => {
    render(<BibleSearchBar />)
    const toggle = screen.getByRole('button', { name: '搜尋經文' })
    await act(async () => {
      fireEvent.click(toggle)
    })
    const closeToggle = screen.getByRole('button', { name: '關閉搜尋' })
    await act(async () => {
      fireEvent.click(closeToggle)
    })
    expect(screen.queryByPlaceholderText('搜尋經文...')).not.toBeInTheDocument()
  })

  it('pressing Escape collapses the search bar', async () => {
    render(<BibleSearchBar />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '搜尋經文' }))
    })
    const input = screen.getByPlaceholderText('搜尋經文...')
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    expect(screen.queryByPlaceholderText('搜尋經文...')).not.toBeInTheDocument()
  })

  it('shows search results dropdown when hasSearched is true', async () => {
    bibleSingleton.content = new Map([
      [
        'cuv',
        [
          {
            number: 1,
            code: 'GEN',
            name: '創世記',
            abbreviation: '創',
            chapters: [{ number: 1, verses: [{ id: 1, number: 1, text: 'In the beginning' }] }]
          }
        ]
      ]
    ])
    render(<BibleSearchBar />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '搜尋經文' }))
    })
    const input = screen.getByPlaceholderText('搜尋經文...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'beginning' } })
    })
    await waitFor(
      () => {
        expect(screen.getByRole('listbox', { name: '搜尋結果' })).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it('shows search results when engine returns ids', async () => {
    mockSearch.mockResolvedValue([1])
    bibleSingleton.content = new Map([
      [
        'cuv',
        [
          {
            number: 1,
            code: 'GEN',
            name: '創世記',
            abbreviation: '創',
            chapters: [{ number: 1, verses: [{ id: 1, number: 1, text: 'In the beginning' }] }]
          }
        ]
      ]
    ])
    render(<BibleSearchBar />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '搜尋經文' }))
    })
    const input = screen.getByPlaceholderText('搜尋經文...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'beginning' } })
    })
    await vi.waitFor(
      () => {
        expect(screen.getByText('創世記 1:1')).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it('clicking a search result calls navigateTo', async () => {
    mockSearch.mockResolvedValue([1])
    bibleSingleton.content = new Map([
      [
        'cuv',
        [
          {
            number: 1,
            code: 'GEN',
            name: '創世記',
            abbreviation: '創',
            chapters: [{ number: 1, verses: [{ id: 1, number: 1, text: 'In the beginning' }] }]
          }
        ]
      ]
    ])
    render(<BibleSearchBar />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '搜尋經文' }))
    })
    const input = screen.getByPlaceholderText('搜尋經文...')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'beginning' } })
    })
    await vi.waitFor(
      () => {
        expect(screen.getByText('創世記 1:1')).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
    const resultBtn = screen.getByText('創世記 1:1').closest('button')!
    fireEvent.mouseDown(resultBtn)
    expect(mockNavigateTo).toHaveBeenCalledWith({ bookNumber: 1, chapter: 1, verse: 1 })
  })

  it('has data-bible-search attribute on input for Ctrl+F focus', async () => {
    render(<BibleSearchBar />)
    const toggle = screen.getByRole('button', { name: '搜尋經文' })
    await act(async () => {
      fireEvent.click(toggle)
    })
    const input = document.querySelector<HTMLInputElement>('[data-bible-search]')
    expect(input).not.toBeNull()
    expect(input).toBeInTheDocument()
  })
})
