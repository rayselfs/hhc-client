import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SoundboardInspector from '@renderer/components/Control/Soundboard/SoundboardInspector'
import { createDefaultSoundboardBoard, useSoundboardStore } from '@renderer/stores/soundboard'

beforeEach(() => {
  const board = createDefaultSoundboardBoard()
  const sceneId = board.sceneOrder[0]
  useSoundboardStore.setState({
    boards: { [board.id]: board },
    boardOrder: [board.id],
    selectedBoardId: board.id,
    selectedSceneId: sceneId,
    selectedPadId: 'pad-1-1',
    mode: 'edit',
    live: {}
  })
})

it('edits the selected pad label and volume', async () => {
  const user = userEvent.setup()
  render(<SoundboardInspector />)

  await user.clear(screen.getByLabelText(/label/i))
  await user.type(screen.getByLabelText(/label/i), 'Rain')
  await user.clear(screen.getByLabelText(/volume/i))
  await user.type(screen.getByLabelText(/volume/i), '50')

  const pad = useSoundboardStore.getState().getSelectedScene()?.pads['pad-1-1']
  expect(pad?.label).toBe('Rain')
  expect(pad?.volume).toBe(0.5)
})
