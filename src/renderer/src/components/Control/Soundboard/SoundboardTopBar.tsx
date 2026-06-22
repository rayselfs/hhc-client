import { Plus } from 'lucide-react'
import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardTopBar(): React.JSX.Element {
  const boards = useSoundboardStore((state) => state.boards)
  const boardOrder = useSoundboardStore((state) => state.boardOrder)
  const selectedBoardId = useSoundboardStore((state) => state.selectedBoardId)
  const selectedSceneId = useSoundboardStore((state) => state.selectedSceneId)
  const mode = useSoundboardStore((state) => state.mode)
  const selectBoard = useSoundboardStore((state) => state.selectBoard)
  const selectScene = useSoundboardStore((state) => state.selectScene)
  const createBoard = useSoundboardStore((state) => state.createBoard)
  const createScene = useSoundboardStore((state) => state.createScene)
  const setMode = useSoundboardStore((state) => state.setMode)
  const board = boards[selectedBoardId]

  if (!board) return <div className="border-b border-border px-4 py-3 text-sm">No board</div>

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <select
        aria-label="Board"
        value={selectedBoardId}
        onChange={(event) => selectBoard(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        {boardOrder.map((boardId) => (
          <option key={boardId} value={boardId}>
            {boards[boardId].name}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Add board"
        className="rounded-md border border-border p-1.5"
        onClick={() => selectBoard(createBoard('New Board'))}
      >
        <Plus className="size-4" />
      </button>
      <select
        aria-label="Scene"
        value={selectedSceneId}
        onChange={(event) => selectScene(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        {board.sceneOrder.map((sceneId) => (
          <option key={sceneId} value={sceneId}>
            {board.scenes[sceneId].name}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Add scene"
        className="rounded-md border border-border p-1.5"
        onClick={() => selectScene(createScene('New Scene'))}
      >
        <Plus className="size-4" />
      </button>
      <button
        type="button"
        className="ml-auto rounded-md border border-border px-3 py-1 text-sm"
        onClick={() => setMode(mode === 'performance' ? 'edit' : 'performance')}
      >
        {mode === 'performance' ? 'Performance' : 'Edit'}
      </button>
    </div>
  )
}
