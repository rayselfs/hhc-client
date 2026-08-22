import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SoundboardGrid from '@renderer/components/Control/Soundboard/SoundboardGrid'
import { createDefaultSoundboardBoard, useSoundboardStore } from '@renderer/stores/soundboard'

beforeEach(() => {
  const board = createDefaultSoundboardBoard()
  useSoundboardStore.setState({
    boards: { [board.id]: board },
    boardOrder: [board.id],
    selectedBoardId: board.id,
    selectedSceneId: board.sceneOrder[0],
    selectedPadId: null,
    mode: 'performance',
    live: {}
  })
})

it('renders 64 pads and selects a pad', async () => {
  const user = userEvent.setup()
  render(<SoundboardGrid onTriggerPad={vi.fn()} onReleasePad={vi.fn()} />)

  const pads = screen.getAllByRole('button', { name: /empty pad/i })
  expect(pads).toHaveLength(64)

  await user.click(pads[0])
  expect(useSoundboardStore.getState().selectedPadId).toBe('pad-1-1')
})
