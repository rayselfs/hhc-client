import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultSoundboardBoard, useSoundboardStore } from '@renderer/stores/soundboard'

describe('soundboard asset usage', () => {
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

  it('finds every pad using an audio asset', () => {
    const state = useSoundboardStore.getState()
    const scene = state.getSelectedScene()
    expect(scene).not.toBeNull()

    const [firstPadId, secondPadId] = scene!.padOrder
    state.assignPadAsset(firstPadId, {
      assetId: 'audio-1',
      name: 'Thunder',
      mimeType: 'audio/mpeg',
      size: 123
    })
    state.assignPadAsset(secondPadId, {
      assetId: 'audio-1',
      name: 'Thunder',
      mimeType: 'audio/mpeg',
      size: 123
    })

    expect(useSoundboardStore.getState().findPadsUsingAsset('audio-1')).toEqual([
      { boardId: 'board-default', sceneId: 'scene-default', padId: firstPadId },
      { boardId: 'board-default', sceneId: 'scene-default', padId: secondPadId }
    ])
  })

  it('returns an empty list for unused assets', () => {
    expect(useSoundboardStore.getState().findPadsUsingAsset('missing')).toEqual([])
  })
})
