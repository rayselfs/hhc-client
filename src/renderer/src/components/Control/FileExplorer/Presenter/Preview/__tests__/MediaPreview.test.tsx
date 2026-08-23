import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MediaPreview from '../MediaPreview'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('MediaPreview', () => {
  it('delegates an end-screen click to the workspace close transaction', () => {
    const onExit = vi.fn()
    render(<MediaPreview currentItem={null} descriptor={null} isEnded onExit={onExit} />)

    fireEvent.click(screen.getByText('presenter.endOfSlides'))

    expect(onExit).toHaveBeenCalledOnce()
  })
})
