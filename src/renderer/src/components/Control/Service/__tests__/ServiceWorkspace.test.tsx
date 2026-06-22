import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import ServiceWorkspace from '../ServiceWorkspace'
import { useServicePlaylistStore } from '@renderer/stores/service-playlist'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useSlidesStore } from '@renderer/stores/slides'

const projectionMocks = vi.hoisted(() => ({
  startProjection: vi.fn(() => Promise.resolve())
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    startProjection: projectionMocks.startProjection
  })
}))

describe('ServiceWorkspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useServicePlaylistStore.getState().clear()
    useFileExplorerStore.setState({ items: {} })
    useSlidesStore.getState().clear()
    projectionMocks.startProjection.mockClear()
  })

  it('renders the empty service workspace', () => {
    render(<ServiceWorkspace />)

    expect(screen.getByRole('heading', { name: 'SERVICE' })).toBeInTheDocument()
    expect(screen.getByText('No cues yet')).toBeInTheDocument()
  })

  it('adds timer, bible, and media cues', async () => {
    const user = userEvent.setup()
    render(<ServiceWorkspace />)

    await user.click(screen.getByRole('button', { name: 'Add Timer' }))
    await user.click(screen.getByRole('button', { name: 'Add Bible' }))
    await user.click(screen.getByRole('button', { name: 'Add Media' }))

    const cues = useServicePlaylistStore.getState().cues
    expect(cues.map((cue) => cue.type)).toEqual(['timer', 'bible', 'media'])
    expect(screen.getByText('Missing media source')).toBeInTheDocument()
  })

  it('reorders, duplicates, completes, and removes cues', async () => {
    const user = userEvent.setup()
    render(<ServiceWorkspace />)

    await user.click(screen.getByRole('button', { name: 'Add Timer' }))
    await user.click(screen.getByRole('button', { name: 'Add Bible' }))

    await user.click(screen.getAllByLabelText('Move down')[0])
    expect(useServicePlaylistStore.getState().cues.map((cue) => cue.type)).toEqual([
      'bible',
      'timer'
    ])

    await user.click(screen.getAllByLabelText('Duplicate cue')[0])
    expect(useServicePlaylistStore.getState().cues).toHaveLength(3)

    await user.click(screen.getAllByLabelText('Mark complete')[0])
    expect(screen.getByText('Completed')).toBeInTheDocument()

    await user.click(screen.getAllByLabelText('Remove cue')[0])
    expect(useServicePlaylistStore.getState().cues).toHaveLength(2)
  })

  it('projects the current timer cue', async () => {
    const user = userEvent.setup()
    render(<ServiceWorkspace />)

    await user.click(screen.getByRole('button', { name: 'Add Timer' }))
    await user.click(screen.getByRole('button', { name: 'Project Current' }))

    expect(projectionMocks.startProjection).toHaveBeenCalledWith('timer')
    expect(await screen.findByText('Projection started.')).toBeInTheDocument()
  })

  it('adds the currently selected native slide as a cue', async () => {
    const user = userEvent.setup()
    const documentId = useSlidesStore.getState().createDocument('Sunday Deck')
    const slideId = useSlidesStore.getState().selectedSlideId
    if (!slideId) throw new Error('Expected selected slide')
    useSlidesStore.getState().updateSlideTitle(documentId, slideId, 'Welcome')
    render(<ServiceWorkspace />)

    await user.click(screen.getByRole('button', { name: 'Add Slide' }))

    expect(useServicePlaylistStore.getState().cues[0]).toMatchObject({
      type: 'slide',
      title: 'Welcome',
      documentId,
      slideId
    })
  })
})
