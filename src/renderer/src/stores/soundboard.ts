import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createPersistName, hhcPersistStorage } from '@renderer/lib/persist-storage'
import type {
  SoundboardAssetRef,
  SoundboardBoard,
  SoundboardLivePadState,
  SoundboardMode,
  SoundboardPad,
  SoundboardScene,
  SoundboardSettings,
  SoundboardTriggerMode
} from '@renderer/types/soundboard'

export const DEFAULT_SOUNDBOARD_GRID = { rows: 8, columns: 8 } as const

const DEFAULT_PAD_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899'
]

export const DEFAULT_SOUNDBOARD_SETTINGS: SoundboardSettings = {
  defaultTriggerMode: 'one-shot',
  defaultLoop: false,
  globalFadeMs: 1000,
  masterVolume: 1,
  midiEnabled: true,
  preferredMidiInputId: null
}

export interface SoundboardAssetUsage {
  boardId: string
  sceneId: string
  padId: string
}

function createPad(row: number, column: number): SoundboardPad {
  const id = `pad-${row + 1}-${column + 1}`
  return {
    id,
    label: '',
    color: DEFAULT_PAD_COLORS[column % DEFAULT_PAD_COLORS.length],
    asset: null,
    triggerMode: DEFAULT_SOUNDBOARD_SETTINGS.defaultTriggerMode,
    loop: DEFAULT_SOUNDBOARD_SETTINGS.defaultLoop,
    volume: 1,
    midiNote: null,
    midiVolume: null
  }
}

function createDefaultScene(): SoundboardScene {
  const pads: Record<string, SoundboardPad> = {}
  const padOrder: string[] = []

  for (let row = 0; row < DEFAULT_SOUNDBOARD_GRID.rows; row++) {
    for (let column = 0; column < DEFAULT_SOUNDBOARD_GRID.columns; column++) {
      const pad = createPad(row, column)
      pads[pad.id] = pad
      padOrder.push(pad.id)
    }
  }

  return {
    id: 'scene-default',
    name: 'Scene 1',
    pads,
    padOrder
  }
}

export function createDefaultSoundboardBoard(): SoundboardBoard {
  const scene = createDefaultScene()
  return {
    id: 'board-default',
    name: 'Default Board',
    scenes: { [scene.id]: scene },
    sceneOrder: [scene.id]
  }
}

interface SoundboardStore {
  boards: Record<string, SoundboardBoard>
  boardOrder: string[]
  selectedBoardId: string
  selectedSceneId: string
  selectedPadId: string | null
  mode: SoundboardMode
  live: Record<string, SoundboardLivePadState>
  settings: SoundboardSettings
  getSelectedBoard: () => SoundboardBoard
  getSelectedScene: () => SoundboardScene | null
  setMode: (mode: SoundboardMode) => void
  createBoard: (name: string) => string
  renameBoard: (boardId: string, name: string) => void
  selectBoard: (boardId: string) => void
  createScene: (name: string) => string
  renameScene: (sceneId: string, name: string) => void
  duplicateScene: (sceneId: string) => string | null
  deleteScene: (sceneId: string) => void
  selectScene: (sceneId: string) => void
  selectPad: (padId: string | null) => void
  updatePad: (padId: string, patch: Partial<SoundboardPad>) => void
  assignPadAsset: (padId: string, asset: SoundboardAssetRef) => void
  clearPadAsset: (padId: string) => void
  findPadsUsingAsset: (assetId: string) => SoundboardAssetUsage[]
  setPadLiveState: (padId: string, state: SoundboardLivePadState) => void
  setMasterVolume: (volume: number) => void
  setGlobalFadeMs: (fadeMs: number) => void
  setDefaultTriggerMode: (mode: SoundboardTriggerMode) => void
  setMidiEnabled: (enabled: boolean) => void
  setPreferredMidiInputId: (inputId: string | null) => void
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function withSelectedScene(
  state: SoundboardStore,
  update: (scene: SoundboardScene) => SoundboardScene
): Partial<SoundboardStore> {
  const board = state.boards[state.selectedBoardId]
  const scene = board?.scenes[state.selectedSceneId]
  if (!board || !scene) return {}
  const nextScene = update(scene)
  return {
    boards: {
      ...state.boards,
      [board.id]: {
        ...board,
        scenes: {
          ...board.scenes,
          [nextScene.id]: nextScene
        }
      }
    }
  }
}

const defaultBoard = createDefaultSoundboardBoard()

export const useSoundboardStore = create<SoundboardStore>()(
  persist(
    (set, get) => ({
      boards: { [defaultBoard.id]: defaultBoard },
      boardOrder: [defaultBoard.id],
      selectedBoardId: defaultBoard.id,
      selectedSceneId: defaultBoard.sceneOrder[0],
      selectedPadId: null,
      mode: 'performance',
      live: {},
      settings: DEFAULT_SOUNDBOARD_SETTINGS,
      getSelectedBoard: () => get().boards[get().selectedBoardId],
      getSelectedScene: () => {
        const board = get().boards[get().selectedBoardId]
        return board?.scenes[get().selectedSceneId] ?? null
      },
      setMode: (mode) => set({ mode }),
      createBoard: (name) => {
        const scene = createDefaultScene()
        const id = crypto.randomUUID()
        const board: SoundboardBoard = {
          id,
          name: name.trim() || 'Untitled Board',
          scenes: { [scene.id]: scene },
          sceneOrder: [scene.id]
        }
        set((state) => ({
          boards: { ...state.boards, [id]: board },
          boardOrder: [...state.boardOrder, id]
        }))
        return id
      },
      renameBoard: (boardId, name) =>
        set((state) => {
          const board = state.boards[boardId]
          if (!board) return {}
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...board, name: name.trim() || board.name }
            }
          }
        }),
      selectBoard: (boardId) =>
        set((state) => {
          const board = state.boards[boardId]
          if (!board) return {}
          return {
            selectedBoardId: boardId,
            selectedSceneId: board.sceneOrder[0],
            selectedPadId: null
          }
        }),
      createScene: (name) => {
        const scene = {
          ...createDefaultScene(),
          id: crypto.randomUUID(),
          name: name.trim() || 'Untitled Scene'
        }
        set((state) => {
          const board = state.boards[state.selectedBoardId]
          if (!board) return {}
          return {
            boards: {
              ...state.boards,
              [board.id]: {
                ...board,
                scenes: { ...board.scenes, [scene.id]: scene },
                sceneOrder: [...board.sceneOrder, scene.id]
              }
            }
          }
        })
        return scene.id
      },
      renameScene: (sceneId, name) =>
        set((state) => {
          const board = state.boards[state.selectedBoardId]
          const scene = board?.scenes[sceneId]
          if (!board || !scene) return {}
          return {
            boards: {
              ...state.boards,
              [board.id]: {
                ...board,
                scenes: {
                  ...board.scenes,
                  [sceneId]: { ...scene, name: name.trim() || scene.name }
                }
              }
            }
          }
        }),
      duplicateScene: (sceneId) => {
        const state = get()
        const board = state.boards[state.selectedBoardId]
        const scene = board?.scenes[sceneId]
        if (!board || !scene) return null
        const id = crypto.randomUUID()
        const copy: SoundboardScene = {
          ...scene,
          id,
          name: `${scene.name} Copy`,
          pads: Object.fromEntries(
            Object.entries(scene.pads).map(([padId, pad]) => [padId, { ...pad }])
          )
        }
        set({
          boards: {
            ...state.boards,
            [board.id]: {
              ...board,
              scenes: { ...board.scenes, [id]: copy },
              sceneOrder: [...board.sceneOrder, id]
            }
          }
        })
        return id
      },
      deleteScene: (sceneId) =>
        set((state) => {
          const board = state.boards[state.selectedBoardId]
          if (!board || board.sceneOrder.length <= 1 || !board.scenes[sceneId]) return {}
          const scenes = { ...board.scenes }
          delete scenes[sceneId]
          const sceneOrder = board.sceneOrder.filter((id) => id !== sceneId)
          return {
            boards: { ...state.boards, [board.id]: { ...board, scenes, sceneOrder } },
            selectedSceneId:
              state.selectedSceneId === sceneId ? sceneOrder[0] : state.selectedSceneId,
            selectedPadId: state.selectedSceneId === sceneId ? null : state.selectedPadId
          }
        }),
      selectScene: (sceneId) =>
        set((state) => {
          const board = state.boards[state.selectedBoardId]
          if (!board?.scenes[sceneId]) return {}
          return { selectedSceneId: sceneId, selectedPadId: null }
        }),
      selectPad: (selectedPadId) => set({ selectedPadId }),
      updatePad: (padId, patch) =>
        set((state) =>
          withSelectedScene(state, (scene) => {
            const pad = scene.pads[padId]
            if (!pad) return scene
            return {
              ...scene,
              pads: {
                ...scene.pads,
                [padId]: { ...pad, ...patch, volume: clampVolume(patch.volume ?? pad.volume) }
              }
            }
          })
        ),
      assignPadAsset: (padId, asset) =>
        get().updatePad(padId, {
          asset,
          label: get().getSelectedScene()?.pads[padId]?.label || asset.name
        }),
      clearPadAsset: (padId) => get().updatePad(padId, { asset: null }),
      findPadsUsingAsset: (assetId) => {
        const usages: SoundboardAssetUsage[] = []
        for (const board of Object.values(get().boards)) {
          for (const scene of Object.values(board.scenes)) {
            for (const pad of Object.values(scene.pads)) {
              if (pad.asset?.assetId === assetId) {
                usages.push({ boardId: board.id, sceneId: scene.id, padId: pad.id })
              }
            }
          }
        }
        return usages
      },
      setPadLiveState: (padId, state) =>
        set((current) => ({ live: { ...current.live, [padId]: state } })),
      setMasterVolume: (volume) =>
        set((state) => ({ settings: { ...state.settings, masterVolume: clampVolume(volume) } })),
      setGlobalFadeMs: (globalFadeMs) =>
        set((state) => ({
          settings: { ...state.settings, globalFadeMs: Math.max(0, Math.floor(globalFadeMs)) }
        })),
      setDefaultTriggerMode: (defaultTriggerMode) =>
        set((state) => ({ settings: { ...state.settings, defaultTriggerMode } })),
      setMidiEnabled: (midiEnabled) =>
        set((state) => ({ settings: { ...state.settings, midiEnabled } })),
      setPreferredMidiInputId: (preferredMidiInputId) =>
        set((state) => ({ settings: { ...state.settings, preferredMidiInputId } }))
    }),
    {
      name: createPersistName('soundboard'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        boards: state.boards,
        boardOrder: state.boardOrder,
        selectedBoardId: state.selectedBoardId,
        selectedSceneId: state.selectedSceneId,
        mode: state.mode,
        settings: state.settings
      })
    }
  )
)
