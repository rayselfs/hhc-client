import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useServicePlaylistStore } from '../service-playlist'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-22T00:00:00Z'))
  useServicePlaylistStore.getState().clear()
})

afterEach(() => {
  vi.useRealTimers()
})

function addMediaCue(title = 'Opening Video'): string {
  return useServicePlaylistStore.getState().addCue({
    type: 'media',
    title,
    fileItemId: `file-${title}`,
    fileName: `${title}.mp4`
  })
}

describe('service playlist store', () => {
  it('adds cues and tracks current, selected, and next cue', () => {
    const firstId = addMediaCue('Opening')
    const secondId = useServicePlaylistStore.getState().addCue({
      type: 'bible',
      title: 'Scripture',
      bookNumber: 43,
      chapter: 3,
      verse: 16,
      reference: 'John 3:16'
    })

    const state = useServicePlaylistStore.getState()
    expect(state.cues).toHaveLength(2)
    expect(state.currentCue()?.id).toBe(firstId)
    expect(state.selectedCue()?.id).toBe(secondId)
    expect(state.nextCue()?.id).toBe(secondId)
  })

  it('jumps to a cue and exposes preview state', () => {
    const firstId = addMediaCue('Opening')
    const secondId = addMediaCue('Sermon')

    useServicePlaylistStore.getState().jumpToCue(secondId)

    const state = useServicePlaylistStore.getState()
    expect(state.currentCue()?.id).toBe(secondId)
    expect(state.selectedCue()?.id).toBe(secondId)
    expect(state.previewCue()?.id).toBe(secondId)
    expect(state.nextCue()).toBeNull()

    useServicePlaylistStore.getState().previewCueById(firstId)
    expect(useServicePlaylistStore.getState().previewCue()?.id).toBe(firstId)
  })

  it('reorders cues without changing current identity', () => {
    const firstId = addMediaCue('A')
    const secondId = addMediaCue('B')
    const thirdId = addMediaCue('C')

    useServicePlaylistStore.getState().jumpToCue(secondId)
    useServicePlaylistStore.getState().reorderCue(2, 0)

    const state = useServicePlaylistStore.getState()
    expect(state.cues.map((cue) => cue.id)).toEqual([thirdId, firstId, secondId])
    expect(state.currentCue()?.id).toBe(secondId)
  })

  it('duplicates cue after the source and clears completion state', () => {
    const sourceId = addMediaCue('Video')
    useServicePlaylistStore.getState().markComplete(sourceId, true)

    const duplicateId = useServicePlaylistStore.getState().duplicateCue(sourceId)

    expect(duplicateId).not.toBeNull()
    const state = useServicePlaylistStore.getState()
    expect(state.cues.map((cue) => cue.id)).toEqual([sourceId, duplicateId])
    expect(state.cues[1]).toMatchObject({
      type: 'media',
      title: 'Video Copy',
      completed: false,
      fileItemId: 'file-Video'
    })
    expect(state.selectedCueId).toBe(duplicateId)
  })

  it('adds slide cues for native slide documents', () => {
    const cueId = useServicePlaylistStore.getState().addCue({
      type: 'slide',
      title: 'Welcome Slide',
      documentId: 'deck-1',
      slideId: 'slide-1',
      documentTitle: 'Sunday Deck',
      slideTitle: 'Welcome'
    })

    expect(useServicePlaylistStore.getState().cues[0]).toMatchObject({
      id: cueId,
      type: 'slide',
      documentId: 'deck-1',
      slideId: 'slide-1'
    })
  })

  it('removes current cue and selects the first remaining cue', () => {
    const firstId = addMediaCue('A')
    const secondId = addMediaCue('B')
    useServicePlaylistStore.getState().jumpToCue(secondId)

    useServicePlaylistStore.getState().removeCue(secondId)

    const state = useServicePlaylistStore.getState()
    expect(state.cues.map((cue) => cue.id)).toEqual([firstId])
    expect(state.currentCueId).toBe(firstId)
    expect(state.selectedCueId).toBe(firstId)
  })

  it('ignores operations for missing cues', () => {
    const firstId = addMediaCue('A')

    expect(useServicePlaylistStore.getState().duplicateCue('missing')).toBeNull()
    useServicePlaylistStore.getState().jumpToCue('missing')
    useServicePlaylistStore.getState().selectCue('missing')
    useServicePlaylistStore.getState().previewCueById('missing')
    useServicePlaylistStore.getState().removeCue('missing')

    const state = useServicePlaylistStore.getState()
    expect(state.cues.map((cue) => cue.id)).toEqual([firstId])
    expect(state.currentCueId).toBe(firstId)
    expect(state.selectedCueId).toBe(firstId)
    expect(state.previewCueId).toBeNull()
  })
})
