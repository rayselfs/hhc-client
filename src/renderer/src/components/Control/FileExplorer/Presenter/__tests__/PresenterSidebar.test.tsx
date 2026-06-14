import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUpdateNotes = vi.fn()
const mockCurrentItem = vi.fn()
const mockNextItem = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    onPress,
    isIconOnly: _isIconOnly,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    onPress?: () => void
    isIconOnly?: boolean
  }) => (
    <button {...props} onClick={onPress}>
      {children}
    </button>
  )
}))

vi.mock('@renderer/components/Common/GlassDivider', () => ({
  default: () => <div data-testid="glass-divider" />
}))

vi.mock('../Preview/NextItemPreview', () => ({
  default: () => <div data-testid="next-item-preview" />
}))

vi.mock('@renderer/stores/media-projection', () => ({
  useMediaProjectionStore: Object.assign(
    (selector: (state: {
      nextItem: typeof mockNextItem
      currentItem: typeof mockCurrentItem
      updateNotes: typeof mockUpdateNotes
    }) => unknown) =>
      selector({
        nextItem: mockNextItem,
        currentItem: mockCurrentItem,
        updateNotes: mockUpdateNotes
      }),
    {
      getState: () => ({
        nextItem: mockNextItem,
        currentItem: mockCurrentItem,
        updateNotes: mockUpdateNotes
      })
    }
  )
}))

import PresenterSidebar from '../PresenterSidebar'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

describe('PresenterSidebar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    void useMediaProjectionStore.getState()
    mockCurrentItem.mockReturnValue({ id: 'b', notes: 'initial' })
    mockNextItem.mockReturnValue(null)
  })

  it('updates local notes immediately and debounces store update', () => {
    render(<PresenterSidebar previewCache={{}} />)

    const textarea = screen.getByPlaceholderText('presenter.notesPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hello' } })

    expect(textarea).toHaveValue('hello')
    expect(mockUpdateNotes).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(mockUpdateNotes).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(mockUpdateNotes).toHaveBeenCalledTimes(1)
    expect(mockUpdateNotes).toHaveBeenCalledWith('b', 'hello')
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
