import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import SlidesWorkspace from '../SlidesWorkspace'
import { useSlidesStore } from '@renderer/stores/slides'

const projectionMocks = vi.hoisted(() => ({
  startProjection: vi.fn(() => Promise.resolve())
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    startProjection: projectionMocks.startProjection
  })
}))

describe('SlidesWorkspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useSlidesStore.getState().clear()
    projectionMocks.startProjection.mockClear()
  })

  it('creates a native slide deck from the empty state', async () => {
    const user = userEvent.setup()
    render(<SlidesWorkspace />)

    await user.click(screen.getByRole('button', { name: 'Create Deck' }))

    expect(screen.getByDisplayValue('Untitled Slide Deck')).toBeInTheDocument()
    expect(useSlidesStore.getState().currentDocument()?.slides).toHaveLength(1)
  })

  it('edits slide title, background, and text elements', async () => {
    const user = userEvent.setup()
    render(<SlidesWorkspace />)

    await user.click(screen.getByRole('button', { name: 'Create Deck' }))
    await user.clear(screen.getByLabelText('Deck title'))
    await user.type(screen.getByLabelText('Deck title'), 'Sunday Lyrics')
    await user.selectOptions(screen.getByLabelText('Template'), 'clean-light')
    await user.clear(screen.getByLabelText('Slide title'))
    await user.type(screen.getByLabelText('Slide title'), 'Verse 1')
    await user.click(screen.getByRole('button', { name: 'Add Text' }))
    await user.clear(screen.getByLabelText('Text content'))
    await user.type(screen.getByLabelText('Text content'), 'Amazing grace')

    const document = useSlidesStore.getState().currentDocument()
    expect(document?.title).toBe('Sunday Lyrics')
    expect(document?.theme.id).toBe('clean-light')
    expect(useSlidesStore.getState().selectedSlide()?.title).toBe('Verse 1')
    expect(useSlidesStore.getState().selectedSlide()?.elements[0]).toMatchObject({
      type: 'text',
      text: 'Amazing grace'
    })
  })

  it('projects the selected slide', async () => {
    const user = userEvent.setup()
    render(<SlidesWorkspace />)

    await user.click(screen.getByRole('button', { name: 'Create Deck' }))
    await user.click(screen.getByRole('button', { name: 'Project Slide' }))

    expect(projectionMocks.startProjection).toHaveBeenCalledWith('slide', [
      [
        'slide:show',
        expect.objectContaining({
          slideIndex: 0,
          document: expect.objectContaining({ title: 'Untitled Slide Deck' })
        })
      ]
    ])
  })
})
