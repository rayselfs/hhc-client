import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import BibleSearchBar from '../BibleSearchBar'

const mockSearch = vi.fn().mockResolvedValue([])

vi.mock('@renderer/lib/bible-search-singleton', () => ({
  searchEngine: {
    search: (...args: unknown[]) => mockSearch(...args)
  },
  lookupVerseById: () => undefined
}))

let mockIsIndexReady = true

vi.mock('@renderer/stores/bible-search', () => {
  const state = {
    isSearchMode: false,
    isSearching: false,
    get isIndexReady() {
      return mockIsIndexReady
    },
    query: '',
    results: [],
    setSearchMode: vi.fn(),
    setIsSearching: vi.fn(),
    setIndexReady: vi.fn(),
    setQuery: vi.fn(),
    setResults: vi.fn(),
    clearSearch: vi.fn()
  }

  const store = Object.assign(
    (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    {
      getState: () => state,
      subscribe: () => () => {}
    }
  )

  return { useBibleSearchStore: store }
})

describe('BibleSearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsIndexReady = true
  })

  it('renders the search toggle button', () => {
    render(<BibleSearchBar />)
    const toggle = screen.getByRole('button')
    expect(toggle).toBeInTheDocument()
  })

  it('expands on click', async () => {
    render(<BibleSearchBar />)
    const toggle = screen.getByRole('button')
    await act(async () => {
      fireEvent.click(toggle)
    })
    const input = screen.getByPlaceholderText('bible.search.placeholder')
    expect(input).toBeInTheDocument()
  })

  it('collapses on Escape', async () => {
    render(<BibleSearchBar />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    const input = screen.getByPlaceholderText('bible.search.placeholder')
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    expect(input).toHaveClass('opacity-0')
  })

  it('is disabled when index is not ready', () => {
    mockIsIndexReady = false
    render(<BibleSearchBar />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('is enabled when index is ready', () => {
    render(<BibleSearchBar />)
    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
  })

  it('calls searchEngine.search on Enter', async () => {
    render(<BibleSearchBar />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    const input = screen.getByPlaceholderText('bible.search.placeholder')
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test query' } })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(mockSearch).toHaveBeenCalledWith('test query')
  })

  it('has data-bible-search attribute on input for Ctrl+F focus', async () => {
    render(<BibleSearchBar />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    const input = document.querySelector<HTMLInputElement>('[data-bible-search]')
    expect(input).not.toBeNull()
    expect(input).toBeInTheDocument()
  })
})
