import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MediaPreview from '../MediaPreview'
import type { MediaTypeDescriptor } from '@renderer/lib/presenter-registry'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('MediaPreview', () => {
  it('delegates an end-screen click to the workspace close transaction', () => {
    const onExit = vi.fn()
    render(
      <MediaPreview onNext={vi.fn()} currentItem={null} descriptor={null} isEnded onExit={onExit} />
    )
    fireEvent.click(screen.getByText('presenter.endOfSlides'))
    expect(onExit).toHaveBeenCalledOnce()
  })

  it('routes preview clicks through the shared next action', () => {
    const onNext = vi.fn()
    render(
      <MediaPreview
        onNext={onNext}
        currentItem={null}
        descriptor={{ clickToAdvance: true } as MediaTypeDescriptor}
        onExit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('presenter.noMediaSelected'))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
