import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultSoundboardBoard,
  DEFAULT_SOUNDBOARD_GRID,
  useSoundboardStore
} from '@renderer/stores/soundboard'

describe('soundboard store', () => {
  beforeEach(() => {
    const board = createDefaultSoundboardBoard()
    useSoundboardStore.setState({
      boards: { [board.id]: board },
      boardOrder: [board.id],
      selectedBoardId: board.id,
      selectedSceneId: board.sceneOrder[0],
      selectedPadId: null,
      mode: 'performance',
      live: {},
      settings: {
        defaultTriggerMode: 'one-shot',
        defaultLoop: false,
        globalFadeMs: 1000,
        masterVolume: 1,
        midiEnabled: true,
        preferredMidiInputId: null
      }
    })
  })

  it('creates one default 8x8 board and scene', () => {
    const state = useSoundboardStore.getState()
    const board = state.boards[state.selectedBoardId]
    const scene = board.scenes[board.sceneOrder[0]]

    expect(DEFAULT_SOUNDBOARD_GRID).toEqual({ rows: 8, columns: 8 })
    expect(board.name).toBe('Default Board')
    expect(scene.padOrder).toHaveLength(64)
    expect(Object.values(scene.pads).every((pad) => pad.triggerMode === 'one-shot')).toBe(true)
  })

  it('assigns and clears an audio asset on a pad', () => {
    const state = useSoundboardStore.getState()
    const board = state.boards[state.selectedBoardId]
    const scene = board.scenes[board.sceneOrder[0]]
    const padId = scene.padOrder[0]

    state.assignPadAsset(padId, {
      assetId: 'file-1',
      name: 'Rain',
      mimeType: 'audio/mpeg',
      size: 123
    })

    expect(useSoundboardStore.getState().getSelectedScene()?.pads[padId].asset?.assetId).toBe(
      'file-1'
    )

    useSoundboardStore.getState().clearPadAsset(padId)
    expect(useSoundboardStore.getState().getSelectedScene()?.pads[padId].asset).toBeNull()
  })

  it('does not persist live playback state in partialized state', () => {
    const state = useSoundboardStore.getState()
    state.setPadLiveState('pad-1', { status: 'playing', startedAt: 1, error: null })

    const persisted = useSoundboardStore.persist
      .getOptions()
      .partialize?.(useSoundboardStore.getState()) as Record<string, unknown>

    expect(persisted.live).toBeUndefined()
  })
})
