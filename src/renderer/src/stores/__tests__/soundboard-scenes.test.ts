import { describe, expect, it } from 'vitest'
import { createDefaultSoundboardBoard, useSoundboardStore } from '@renderer/stores/soundboard'

describe('soundboard board and scene management', () => {
  it('creates and switches scenes without clearing live playback', () => {
    const board = createDefaultSoundboardBoard()
    useSoundboardStore.setState({
      boards: { [board.id]: board },
      boardOrder: [board.id],
      selectedBoardId: board.id,
      selectedSceneId: board.sceneOrder[0],
      live: { 'pad-1-1': { status: 'playing', startedAt: 1, error: null } }
    })

    const sceneId = useSoundboardStore.getState().createScene('Scene 2')
    useSoundboardStore.getState().selectScene(sceneId)

    expect(useSoundboardStore.getState().selectedSceneId).toBe(sceneId)
    expect(useSoundboardStore.getState().live['pad-1-1']?.status).toBe('playing')
  })

  it('creates a board with a default scene', () => {
    const boardId = useSoundboardStore.getState().createBoard('Drama')
    useSoundboardStore.getState().selectBoard(boardId)

    const board = useSoundboardStore.getState().getSelectedBoard()
    expect(board.name).toBe('Drama')
    expect(board.sceneOrder).toHaveLength(1)
  })
})
