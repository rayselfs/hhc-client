# M7 Soundboard & MIDI Implementation Plan

> Consolidated from the previous Soundboard plan. This file is now the roadmap source of truth for Soundboard work.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a top-level Soundboard workspace for live audio cue playback with boards, scenes, pads, Web Audio playback, asset assignment, MIDI input mapping, and preferences.

**Architecture:** Keep Soundboard renderer-owned: Zustand stores hold serializable board/scene/pad/settings state, small React components render the dense control surface, and a renderer Web Audio engine handles playback in both Electron and browser. Reuse the existing File Explorer media storage (`file-explorer-db`, `upload-utils`, `FileItemRecord`) for audio assets instead of creating a second asset system.

**Tech Stack:** React 19, TypeScript, Zustand `persist`, HeroUI v3/react-aria components, lucide-react, Web Audio API, Web MIDI API, Vitest/jsdom.

---

## File Structure

- Modify `src/renderer/src/lib/media-capabilities.ts`: add audio capabilities and reusable audio filters.
- Modify `src/renderer/src/lib/upload-utils.ts`: expose upload helpers that can restrict uploads to audio.
- Create `src/renderer/src/types/soundboard.ts`: shared renderer types for boards, scenes, pads, playback state, MIDI mappings, and preferences.
- Create `src/renderer/src/stores/soundboard.ts`: persistent Zustand store for boards/scenes/pads/settings and non-persisted selection state.
- Create `src/renderer/src/lib/soundboard-audio.ts`: small Web Audio playback engine.
- Create `src/renderer/src/lib/soundboard-midi.ts`: Web MIDI capability, device listing, event normalization, and learn helpers.
- Create `src/renderer/src/components/Control/Soundboard/SoundboardGrid.tsx`: 8x8 pad grid.
- Create `src/renderer/src/components/Control/Soundboard/SoundboardLibrary.tsx`: audio asset list and upload entry point.
- Create `src/renderer/src/components/Control/Soundboard/SoundboardInspector.tsx`: selected pad editing.
- Create `src/renderer/src/components/Control/Soundboard/SoundboardMixer.tsx`: master/per-pad live controls.
- Create `src/renderer/src/components/Control/Soundboard/SoundboardTopBar.tsx`: board/scene selectors, mode switch, MIDI status.
- Create `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`: page composition and audio/MIDI wiring.
- Create `src/renderer/src/components/Control/UserMenu/SoundboardSettings.tsx`: preferences panel.
- Modify `src/renderer/src/pages/SoundboardPage.tsx`: route page wrapper.
- Modify `src/renderer/src/router.tsx`: lazy route.
- Modify `src/renderer/src/components/Control/Sidebar.tsx`: top-level nav item.
- Modify `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`: Soundboard preferences category.
- Modify `src/renderer/src/locales/en.json`, `src/renderer/src/locales/zh-TW.json`, `src/renderer/src/locales/zh-CN.json`: labels.
- Add tests under `src/renderer/src/lib/__tests__/`, `src/renderer/src/stores/__tests__/`, `src/renderer/src/components/Control/Soundboard/__tests__/`, and update router/sidebar/preferences tests.
- Create `docs/soundboard-architecture.md`: implementation notes and non-goals.

## Implementation Notes

- No new dependencies. Existing `@dnd-kit/core`, HeroUI, Zustand, and Web APIs cover the first version.
- Do not add Electron-native audio playback. Web Audio runs in the renderer in both modes.
- Add audio to the existing media capability registry so File Explorer can store audio files canonically.
- Treat MIDI as optional. Mouse playback remains complete when MIDI is unsupported, denied, or unplugged.
- Keep import/export of MIDI mappings out of the first implementation. Persistence is enough.

---

### Task 1: Add Audio Media Capability Support

**Files:**
- Modify: `src/renderer/src/lib/media-capabilities.ts`
- Modify: `src/renderer/src/lib/upload-utils.ts`
- Test: `src/renderer/src/lib/__tests__/media-capabilities.test.ts`
- Test: `src/renderer/src/lib/__tests__/upload-utils.test.ts`

- [ ] **Step 1: Extend media capability tests first**

Add these tests to `src/renderer/src/lib/__tests__/media-capabilities.test.ts`:

```typescript
import {
  classifyFile,
  getAudioFileAcceptAttribute,
  getMediaFileAcceptAttribute,
  isAudioMediaItem,
  resolveMediaCapability
} from '@renderer/lib/media-capabilities'
import type { FileItemRecord } from '@shared/types/folder'

describe('audio media capabilities', () => {
  it('classifies common audio files as native media', () => {
    expect(classifyFile({ name: 'storm.mp3', type: 'audio/mpeg' }, 'web')).toMatchObject({
      kind: 'audio',
      mimeType: 'audio/mpeg',
      support: 'native'
    })
    expect(classifyFile({ name: 'bed.wav', type: 'audio/wav' }, 'electron')).toMatchObject({
      kind: 'audio',
      mimeType: 'audio/wav',
      support: 'native'
    })
    expect(classifyFile({ name: 'cue.m4a', type: '' }, 'web')).toMatchObject({
      kind: 'audio',
      mimeType: 'audio/mp4',
      support: 'native'
    })
  })

  it('includes audio in the general accept attribute and exposes audio-only accept', () => {
    expect(getMediaFileAcceptAttribute('web')).toContain('audio/*')
    expect(getAudioFileAcceptAttribute('web')).toBe('audio/*,.mp3,.wav,.m4a,.aac,.ogg')
  })

  it('detects audio file explorer items', () => {
    const item: FileItemRecord = {
      id: 'file-1',
      parentId: 'file-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'rain.mp3',
      url: 'blob:file-1',
      size: 10,
      mimeType: 'audio/mpeg'
    }

    expect(isAudioMediaItem(item)).toBe(true)
    expect(resolveMediaCapability({ mimeType: item.mimeType, fileName: item.name })?.kind).toBe(
      'audio'
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/media-capabilities.test.ts
```

Expected: FAIL because `audio` capability and helpers do not exist yet.

- [ ] **Step 3: Implement audio capabilities**

In `src/renderer/src/lib/media-capabilities.ts`, make these exact changes:

```typescript
import type { FileItemRecord } from '@shared/types/folder'

export type MediaKind = 'image' | 'video' | 'audio' | 'pdf' | 'document'
```

Add audio entries to `CAPABILITIES` before video entries:

```typescript
  {
    kind: 'audio',
    extensions: ['mp3'],
    canonicalMimeType: 'audio/mpeg',
    aliases: ['audio/mp3'],
    thumbnail: 'none',
    web: 'native',
    electron: 'native',
    kindLabelKey: 'fileKind.mp3Audio',
    kindLabelFallback: 'MP3 Audio'
  },
  {
    kind: 'audio',
    extensions: ['wav'],
    canonicalMimeType: 'audio/wav',
    aliases: ['audio/x-wav', 'audio/wave'],
    thumbnail: 'none',
    web: 'native',
    electron: 'native',
    kindLabelKey: 'fileKind.wavAudio',
    kindLabelFallback: 'WAV Audio'
  },
  {
    kind: 'audio',
    extensions: ['m4a'],
    canonicalMimeType: 'audio/mp4',
    aliases: ['audio/x-m4a'],
    thumbnail: 'none',
    web: 'native',
    electron: 'native',
    kindLabelKey: 'fileKind.m4aAudio',
    kindLabelFallback: 'M4A Audio'
  },
  {
    kind: 'audio',
    extensions: ['aac'],
    canonicalMimeType: 'audio/aac',
    thumbnail: 'none',
    web: 'native',
    electron: 'native',
    kindLabelKey: 'fileKind.aacAudio',
    kindLabelFallback: 'AAC Audio'
  },
  {
    kind: 'audio',
    extensions: ['ogg'],
    canonicalMimeType: 'audio/ogg',
    aliases: ['application/ogg'],
    thumbnail: 'none',
    web: 'native',
    electron: 'native',
    kindLabelKey: 'fileKind.oggAudio',
    kindLabelFallback: 'OGG Audio'
  },
```

Add the generic audio fallback beside the generic video fallback:

```typescript
const GENERIC_AUDIO_CAPABILITY: MediaCapability = {
  kind: 'audio',
  extensions: [],
  canonicalMimeType: 'audio/*',
  thumbnail: 'none',
  web: 'native',
  electron: 'native'
}
```

Update `resolveMediaCapability()`:

```typescript
  if (mimeType.startsWith('image/')) return GENERIC_IMAGE_CAPABILITY
  if (mimeType.startsWith('video/')) return GENERIC_VIDEO_CAPABILITY
  if (mimeType.startsWith('audio/')) return GENERIC_AUDIO_CAPABILITY
  return null
```

Replace `getMediaFileAcceptAttribute()` and add audio helpers:

```typescript
function getSupportedExtensions(platform: MediaPlatform, kind?: MediaKind): string[] {
  return CAPABILITIES.filter(
    (capability) =>
      getMediaSupport(capability, platform) !== 'unsupported' &&
      (kind === undefined || capability.kind === kind)
  ).flatMap((capability) => capability.extensions.map((extension) => `.${extension}`))
}

export function getMediaFileAcceptAttribute(platform: MediaPlatform): string {
  return ['image/*', 'video/*', 'audio/*', ...new Set(getSupportedExtensions(platform))].join(',')
}

export function getAudioFileAcceptAttribute(platform: MediaPlatform): string {
  return ['audio/*', ...new Set(getSupportedExtensions(platform, 'audio'))].join(',')
}

export function isAudioMediaItem(item: FileItemRecord): boolean {
  return resolveMediaCapability({ mimeType: item.mimeType, fileName: item.name })?.kind === 'audio'
}
```

- [ ] **Step 4: Add audio-only upload filtering test**

Add this test to `src/renderer/src/lib/__tests__/upload-utils.test.ts`:

```typescript
import { prepareUploadFilesForKind } from '@renderer/lib/upload-utils'

describe('prepareUploadFilesForKind', () => {
  it('keeps only audio files when requested', async () => {
    const files = [
      new File(['x'], 'cue.mp3', { type: 'audio/mpeg' }),
      new File(['x'], 'slide.png', { type: 'image/png' })
    ]

    const candidates = await prepareUploadFilesForKind(files, 'audio')

    expect(candidates).toHaveLength(1)
    expect(candidates[0].file.name).toBe('cue.mp3')
    expect(candidates[0].classification.kind).toBe('audio')
  })
})
```

- [ ] **Step 5: Expose upload filtering**

In `src/renderer/src/lib/upload-utils.ts`, export `UploadCandidate`, import `MediaKind`, and add:

```typescript
export interface UploadCandidate {
  file: File
  classification: ClassifiedFile
}

export async function prepareUploadFilesForKind(
  files: File[],
  kind: Exclude<MediaKind, 'document'>
): Promise<UploadCandidate[]> {
  const candidates = await prepareUploadCandidates(files)
  return candidates.filter((candidate) => candidate.classification.kind === kind)
}

export async function uploadFilesForKind(
  files: File[],
  parentId: string,
  kind: Exclude<MediaKind, 'document'>
): Promise<number> {
  const candidates = await prepareUploadFilesForKind(files, kind)
  return uploadPreparedFiles(candidates.map((candidate) => ({ ...candidate, parentId })))
}
```

Remove the old non-exported `interface UploadCandidate` to avoid duplicate declarations.

- [ ] **Step 6: Run tests**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/media-capabilities.test.ts src/renderer/src/lib/__tests__/upload-utils.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/lib/media-capabilities.ts src/renderer/src/lib/upload-utils.ts src/renderer/src/lib/__tests__/media-capabilities.test.ts src/renderer/src/lib/__tests__/upload-utils.test.ts
git commit -m "feat: add audio media capability support"
```

---

### Task 2: Add Soundboard Types and Store

**Files:**
- Create: `src/renderer/src/types/soundboard.ts`
- Create: `src/renderer/src/stores/soundboard.ts`
- Test: `src/renderer/src/stores/__tests__/soundboard.test.ts`

- [ ] **Step 1: Write store tests**

Create `src/renderer/src/stores/__tests__/soundboard.test.ts`:

```typescript
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

    const persisted = useSoundboardStore.persist.getOptions().partialize?.(
      useSoundboardStore.getState()
    ) as Record<string, unknown>

    expect(persisted.live).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/soundboard.test.ts
```

Expected: FAIL because the Soundboard types/store do not exist.

- [ ] **Step 3: Create shared Soundboard types**

Create `src/renderer/src/types/soundboard.ts`:

```typescript
export type SoundboardMode = 'performance' | 'edit'
export type SoundboardTriggerMode = 'one-shot' | 'toggle' | 'hold'
export type SoundboardPadStatus = 'idle' | 'loading' | 'playing' | 'error'

export interface SoundboardGridSize {
  rows: number
  columns: number
}

export interface SoundboardAssetRef {
  assetId: string
  name: string
  mimeType: string
  size: number
}

export interface SoundboardMidiNoteMapping {
  inputId: string
  channel: number
  note: number
}

export interface SoundboardMidiCcMapping {
  inputId: string
  channel: number
  controller: number
}

export interface SoundboardPad {
  id: string
  label: string
  color: string
  asset: SoundboardAssetRef | null
  triggerMode: SoundboardTriggerMode
  loop: boolean
  volume: number
  midiNote: SoundboardMidiNoteMapping | null
  midiVolume: SoundboardMidiCcMapping | null
}

export interface SoundboardScene {
  id: string
  name: string
  pads: Record<string, SoundboardPad>
  padOrder: string[]
}

export interface SoundboardBoard {
  id: string
  name: string
  scenes: Record<string, SoundboardScene>
  sceneOrder: string[]
}

export interface SoundboardLivePadState {
  status: SoundboardPadStatus
  startedAt: number | null
  error: string | null
}

export interface SoundboardSettings {
  defaultTriggerMode: SoundboardTriggerMode
  defaultLoop: boolean
  globalFadeMs: number
  masterVolume: number
  midiEnabled: boolean
  preferredMidiInputId: string | null
}
```

- [ ] **Step 4: Create the store**

Create `src/renderer/src/stores/soundboard.ts`:

```typescript
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
  selectBoard: (boardId: string) => void
  selectScene: (sceneId: string) => void
  selectPad: (padId: string | null) => void
  updatePad: (padId: string, patch: Partial<SoundboardPad>) => void
  assignPadAsset: (padId: string, asset: SoundboardAssetRef) => void
  clearPadAsset: (padId: string) => void
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
        get().updatePad(padId, { asset, label: get().getSelectedScene()?.pads[padId]?.label || asset.name }),
      clearPadAsset: (padId) => get().updatePad(padId, { asset: null }),
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
```

- [ ] **Step 5: Run store tests**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/soundboard.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/types/soundboard.ts src/renderer/src/stores/soundboard.ts src/renderer/src/stores/__tests__/soundboard.test.ts
git commit -m "feat: add soundboard state model"
```

---

### Task 3: Add Route, Sidebar, and Page Shell

**Files:**
- Create: `src/renderer/src/pages/SoundboardPage.tsx`
- Create: `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`
- Modify: `src/renderer/src/router.tsx`
- Modify: `src/renderer/src/components/Control/Sidebar.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/__tests__/router.test.tsx`
- Test: `src/renderer/src/components/Control/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Add route tests**

Update `src/renderer/src/__tests__/router.test.tsx`:

```typescript
vi.mock('@renderer/pages/SoundboardPage', () => ({
  default: () => <div data-testid="soundboard-page" />
}))

it('renders soundboard page at /soundboard route', async () => {
  renderWithRouter(['/soundboard'])
  expect(await screen.findByTestId('soundboard-page')).toBeInTheDocument()
})
```

- [ ] **Step 2: Add sidebar test**

Add this assertion to the sidebar navigation test in `src/renderer/src/components/Control/__tests__/Sidebar.test.tsx`:

```typescript
expect(screen.getByRole('link', { name: /soundboard/i })).toHaveAttribute('href', '#/soundboard')
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npx vitest run src/renderer/src/__tests__/router.test.tsx src/renderer/src/components/Control/__tests__/Sidebar.test.tsx
```

Expected: FAIL because the route, nav item, and translation key do not exist.

- [ ] **Step 4: Create the page content**

Create `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`:

```tsx
import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardPageContent(): React.JSX.Element {
  const board = useSoundboardStore((state) => state.getSelectedBoard())
  const scene = useSoundboardStore((state) => state.getSelectedScene())

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" data-testid="soundboard-page-content">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Soundboard</h1>
          <p className="text-xs text-muted">{board.name} / {scene?.name ?? 'No scene'}</p>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center text-sm text-muted">
        Soundboard workspace
      </div>
    </main>
  )
}
```

Create `src/renderer/src/pages/SoundboardPage.tsx`:

```tsx
import SoundboardPageContent from '@renderer/components/Control/Soundboard/SoundboardPageContent'

export default function SoundboardPage(): React.JSX.Element {
  return <SoundboardPageContent />
}
```

- [ ] **Step 5: Wire the route**

In `src/renderer/src/router.tsx`, add:

```typescript
const SoundboardPage = lazy(() => import('@renderer/pages/SoundboardPage'))
```

Add this child route after Bible:

```tsx
      {
        path: 'soundboard',
        element: <Suspense fallback={null}><SoundboardPage /></Suspense>,
        ErrorBoundary: RouteError
      },
```

- [ ] **Step 6: Add sidebar nav item**

In `src/renderer/src/components/Control/Sidebar.tsx`, import `Grid3X3`:

```typescript
import { Timer, BookOpen, ChevronDown, ChevronRight, Film, Star, Trash2, Files, Grid3X3 } from 'lucide-react'
```

Add to `topItems`:

```typescript
    { to: '/soundboard', icon: Grid3X3, label: t('nav.soundboard') }
```

- [ ] **Step 7: Add locale labels**

Add to each locale file under `nav`:

```json
"soundboard": "Soundboard"
```

For `zh-TW.json` and `zh-CN.json`, use:

```json
"soundboard": "音效板"
```

- [ ] **Step 8: Run tests**

Run:

```bash
npx vitest run src/renderer/src/__tests__/router.test.tsx src/renderer/src/components/Control/__tests__/Sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/pages/SoundboardPage.tsx src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx src/renderer/src/router.tsx src/renderer/src/components/Control/Sidebar.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json src/renderer/src/__tests__/router.test.tsx src/renderer/src/components/Control/__tests__/Sidebar.test.tsx
git commit -m "feat: add soundboard route"
```

---

### Task 4: Build Grid, Library, Inspector, and Assignment

**Files:**
- Create: `src/renderer/src/components/Control/Soundboard/SoundboardGrid.tsx`
- Create: `src/renderer/src/components/Control/Soundboard/SoundboardLibrary.tsx`
- Create: `src/renderer/src/components/Control/Soundboard/SoundboardInspector.tsx`
- Modify: `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`
- Test: `src/renderer/src/components/Control/Soundboard/__tests__/SoundboardGrid.test.tsx`
- Test: `src/renderer/src/components/Control/Soundboard/__tests__/SoundboardAssignment.test.tsx`

- [ ] **Step 1: Write grid and assignment tests**

Create `src/renderer/src/components/Control/Soundboard/__tests__/SoundboardGrid.test.tsx`:

```tsx
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
```

Create `src/renderer/src/components/Control/Soundboard/__tests__/SoundboardAssignment.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/renderer/src/components/Control/Soundboard/__tests__/SoundboardGrid.test.tsx src/renderer/src/components/Control/Soundboard/__tests__/SoundboardAssignment.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the grid**

Create `src/renderer/src/components/Control/Soundboard/SoundboardGrid.tsx`:

```tsx
import { useSoundboardStore } from '@renderer/stores/soundboard'

interface SoundboardGridProps {
  onTriggerPad: (padId: string) => void
  onReleasePad: (padId: string) => void
}

export default function SoundboardGrid({
  onTriggerPad,
  onReleasePad
}: SoundboardGridProps): React.JSX.Element {
  const scene = useSoundboardStore((state) => state.getSelectedScene())
  const selectedPadId = useSoundboardStore((state) => state.selectedPadId)
  const selectPad = useSoundboardStore((state) => state.selectPad)
  const live = useSoundboardStore((state) => state.live)

  if (!scene) return <div className="p-4 text-sm text-muted">No scene</div>

  return (
    <section className="grid min-h-0 flex-1 grid-cols-8 gap-2 p-3" aria-label="Soundboard pads">
      {scene.padOrder.map((padId) => {
        const pad = scene.pads[padId]
        const status = live[padId]?.status ?? 'idle'
        const active = selectedPadId === padId
        const label = pad.label || pad.asset?.name || 'Empty pad'

        return (
          <button
            key={pad.id}
            type="button"
            aria-label={label}
            aria-pressed={status === 'playing'}
            onClick={() => {
              selectPad(pad.id)
              onTriggerPad(pad.id)
            }}
            onPointerUp={() => onReleasePad(pad.id)}
            className={`min-h-16 rounded-lg border p-2 text-left text-xs font-semibold text-white shadow-sm transition ${
              active ? 'border-white ring-2 ring-white/70' : 'border-white/10'
            }`}
            style={{ backgroundColor: pad.asset ? pad.color : '#27272a' }}
          >
            <span className="line-clamp-2 break-words">{label}</span>
            <span className="mt-2 block text-[10px] uppercase opacity-75">{status}</span>
          </button>
        )
      })}
    </section>
  )
}
```

- [ ] **Step 4: Implement the library**

Create `src/renderer/src/components/Control/Soundboard/SoundboardLibrary.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@heroui/react/button'
import { getAudioFileAcceptAttribute, isAudioMediaItem } from '@renderer/lib/media-capabilities'
import { getUploadMediaPlatform, uploadFilesForKind } from '@renderer/lib/upload-utils'
import { FILE_EXPLORER_ROOT_ID, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useSoundboardStore } from '@renderer/stores/soundboard'
import type { FileItemRecord } from '@shared/types/folder'

export default function SoundboardLibrary(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const items = useFileExplorerStore((state) => state.items)
  const assignPadAsset = useSoundboardStore((state) => state.assignPadAsset)
  const selectedPadId = useSoundboardStore((state) => state.selectedPadId)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void useFileExplorerStore.getState().ensureItemsLoaded(FILE_EXPLORER_ROOT_ID)
  }, [])

  const audioItems = useMemo(
    () =>
      Object.values(items)
        .filter((item): item is FileItemRecord => item.type === 'file' && isAudioMediaItem(item))
        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  )

  async function handleUpload(files: FileList | null): Promise<void> {
    const selected = Array.from(files ?? [])
    if (selected.length === 0) return
    await uploadFilesForKind(selected, FILE_EXPLORER_ROOT_ID, 'audio')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-secondary">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <input
          aria-label="Search audio"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <Button isIconOnly size="sm" variant="flat" onPress={() => inputRef.current?.click()}>
          <Upload className="size-4" />
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={getAudioFileAcceptAttribute(getUploadMediaPlatform())}
          className="hidden"
          onChange={(event) => void handleUpload(event.currentTarget.files)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {audioItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/15"
            onClick={() => {
              if (!selectedPadId) return
              assignPadAsset(selectedPadId, {
                assetId: item.id,
                name: item.name,
                mimeType: item.mimeType,
                size: item.size
              })
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Implement the inspector**

Create `src/renderer/src/components/Control/Soundboard/SoundboardInspector.tsx`:

```tsx
import { useSoundboardStore } from '@renderer/stores/soundboard'
import type { SoundboardTriggerMode } from '@renderer/types/soundboard'

const TRIGGER_MODES: SoundboardTriggerMode[] = ['one-shot', 'toggle', 'hold']

export default function SoundboardInspector(): React.JSX.Element {
  const scene = useSoundboardStore((state) => state.getSelectedScene())
  const selectedPadId = useSoundboardStore((state) => state.selectedPadId)
  const updatePad = useSoundboardStore((state) => state.updatePad)
  const clearPadAsset = useSoundboardStore((state) => state.clearPadAsset)
  const pad = selectedPadId ? scene?.pads[selectedPadId] : null

  if (!pad) {
    return <aside className="w-72 shrink-0 border-l border-border p-3 text-sm text-muted">Select a pad</aside>
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 border-l border-border bg-surface-secondary p-3">
      <label className="grid gap-1 text-xs font-medium">
        Label
        <input
          aria-label="Label"
          value={pad.label}
          onChange={(event) => updatePad(pad.id, { label: event.target.value })}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Trigger mode
        <select
          aria-label="Trigger mode"
          value={pad.triggerMode}
          onChange={(event) =>
            updatePad(pad.id, { triggerMode: event.target.value as SoundboardTriggerMode })
          }
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          {TRIGGER_MODES.map((mode) => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={pad.loop}
          onChange={(event) => updatePad(pad.id, { loop: event.target.checked })}
        />
        Loop
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Volume
        <input
          aria-label="Volume"
          type="number"
          min={0}
          max={100}
          value={Math.round(pad.volume * 100)}
          onChange={(event) => updatePad(pad.id, { volume: Number(event.target.value) / 100 })}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Color
        <input
          aria-label="Color"
          type="color"
          value={pad.color}
          onChange={(event) => updatePad(pad.id, { color: event.target.value })}
          className="h-9 rounded-md border border-border bg-background"
        />
      </label>
      <div className="rounded-md border border-border p-2 text-xs">
        <div className="font-medium">Asset</div>
        <div className="mt-1 truncate text-muted">{pad.asset?.name ?? 'No audio assigned'}</div>
        {pad.asset && (
          <button type="button" className="mt-2 text-danger" onClick={() => clearPadAsset(pad.id)}>
            Clear
          </button>
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 6: Compose the page**

Replace `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx` with:

```tsx
import SoundboardGrid from '@renderer/components/Control/Soundboard/SoundboardGrid'
import SoundboardInspector from '@renderer/components/Control/Soundboard/SoundboardInspector'
import SoundboardLibrary from '@renderer/components/Control/Soundboard/SoundboardLibrary'
import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardPageContent(): React.JSX.Element {
  const board = useSoundboardStore((state) => state.getSelectedBoard())
  const scene = useSoundboardStore((state) => state.getSelectedScene())
  const mode = useSoundboardStore((state) => state.mode)
  const setMode = useSoundboardStore((state) => state.setMode)

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" data-testid="soundboard-page-content">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Soundboard</h1>
          <p className="text-xs text-muted">{board.name} / {scene?.name ?? 'No scene'}</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 text-sm"
          onClick={() => setMode(mode === 'performance' ? 'edit' : 'performance')}
        >
          {mode === 'performance' ? 'Performance' : 'Edit'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && <SoundboardLibrary />}
        <SoundboardGrid onTriggerPad={() => undefined} onReleasePad={() => undefined} />
        {mode === 'edit' && <SoundboardInspector />}
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npx vitest run src/renderer/src/components/Control/Soundboard/__tests__/SoundboardGrid.test.tsx src/renderer/src/components/Control/Soundboard/__tests__/SoundboardAssignment.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/Control/Soundboard src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx
git commit -m "feat: add soundboard grid and assignment UI"
```

---

### Task 5: Add Web Audio Playback

**Files:**
- Create: `src/renderer/src/lib/soundboard-audio.ts`
- Modify: `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`
- Test: `src/renderer/src/lib/__tests__/soundboard-audio.test.ts`

- [ ] **Step 1: Write audio engine tests**

Create `src/renderer/src/lib/__tests__/soundboard-audio.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { createSoundboardAudioEngine } from '@renderer/lib/soundboard-audio'

class FakeGain {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  }
  connect = vi.fn()
}

class FakeBufferSource {
  buffer: unknown = null
  loop = false
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
  onended: (() => void) | null = null
}

class FakeAudioContext {
  currentTime = 0
  destination = {}
  createGain = vi.fn(() => new FakeGain())
  createBufferSource = vi.fn(() => new FakeBufferSource())
  decodeAudioData = vi.fn(async () => ({ duration: 1 }))
  resume = vi.fn(async () => undefined)
}

it('starts and stops a cue', async () => {
  const context = new FakeAudioContext()
  const engine = createSoundboardAudioEngine(context as unknown as AudioContext)
  const buffer = await engine.load('pad-1', new Blob(['audio'], { type: 'audio/mpeg' }))

  engine.play({ padId: 'pad-1', buffer, loop: true, volume: 0.5 })

  expect(context.createBufferSource).toHaveBeenCalled()
  expect(engine.isPlaying('pad-1')).toBe(true)

  engine.stop('pad-1')
  expect(engine.isPlaying('pad-1')).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/soundboard-audio.test.ts
```

Expected: FAIL because the engine does not exist.

- [ ] **Step 3: Implement the engine**

Create `src/renderer/src/lib/soundboard-audio.ts`:

```typescript
interface PlayOptions {
  padId: string
  buffer: AudioBuffer
  loop: boolean
  volume: number
}

interface PlayingCue {
  source: AudioBufferSourceNode
  gain: GainNode
}

export interface SoundboardAudioEngine {
  load: (assetId: string, blob: Blob) => Promise<AudioBuffer>
  play: (options: PlayOptions) => void
  stop: (padId: string) => void
  fadeOut: (padId: string, fadeMs: number) => void
  stopAll: () => void
  setMasterVolume: (volume: number) => void
  isPlaying: (padId: string) => boolean
  dispose: () => void
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function createSoundboardAudioEngine(context = new AudioContext()): SoundboardAudioEngine {
  const master = context.createGain()
  const buffers = new Map<string, AudioBuffer>()
  const playing = new Map<string, PlayingCue[]>()
  master.connect(context.destination)

  function removeCue(padId: string, cue: PlayingCue): void {
    const cues = playing.get(padId) ?? []
    const next = cues.filter((item) => item !== cue)
    if (next.length === 0) {
      playing.delete(padId)
    } else {
      playing.set(padId, next)
    }
  }

  return {
    async load(assetId, blob) {
      const cached = buffers.get(assetId)
      if (cached) return cached
      const buffer = await context.decodeAudioData(await blob.arrayBuffer())
      buffers.set(assetId, buffer)
      return buffer
    },
    play({ padId, buffer, loop, volume }) {
      void context.resume()
      const source = context.createBufferSource()
      const gain = context.createGain()
      const cue: PlayingCue = { source, gain }
      source.buffer = buffer
      source.loop = loop
      gain.gain.value = clampVolume(volume)
      source.connect(gain)
      gain.connect(master)
      source.onended = () => removeCue(padId, cue)
      playing.set(padId, [...(playing.get(padId) ?? []), cue])
      source.start()
    },
    stop(padId) {
      const cues = playing.get(padId) ?? []
      for (const cue of cues) cue.source.stop()
      playing.delete(padId)
    },
    fadeOut(padId, fadeMs) {
      const cues = playing.get(padId) ?? []
      const endAt = context.currentTime + fadeMs / 1000
      for (const cue of cues) {
        cue.gain.gain.setValueAtTime(cue.gain.gain.value, context.currentTime)
        cue.gain.gain.linearRampToValueAtTime(0, endAt)
        cue.source.stop(endAt)
      }
      playing.delete(padId)
    },
    stopAll() {
      for (const padId of [...playing.keys()]) this.stop(padId)
    },
    setMasterVolume(volume) {
      master.gain.value = clampVolume(volume)
    },
    isPlaying: (padId) => (playing.get(padId)?.length ?? 0) > 0,
    dispose() {
      for (const padId of [...playing.keys()]) this.stop(padId)
      buffers.clear()
      void context.close?.()
    }
  }
}
```

- [ ] **Step 4: Wire playback into the page**

In `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`, add:

```tsx
import { useCallback, useEffect, useRef } from 'react'
import { getFileBlob, getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { createSoundboardAudioEngine, type SoundboardAudioEngine } from '@renderer/lib/soundboard-audio'
```

Inside the component:

```tsx
  const engineRef = useRef<SoundboardAudioEngine | null>(null)
  const settings = useSoundboardStore((state) => state.settings)
  const setPadLiveState = useSoundboardStore((state) => state.setPadLiveState)

  useEffect(() => {
    engineRef.current = createSoundboardAudioEngine()
    return () => engineRef.current?.dispose()
  }, [])

  useEffect(() => {
    engineRef.current?.setMasterVolume(settings.masterVolume)
  }, [settings.masterVolume])

  const triggerPad = useCallback(async (padId: string): Promise<void> => {
    const state = useSoundboardStore.getState()
    const pad = state.getSelectedScene()?.pads[padId]
    if (!pad?.asset || !engineRef.current) return

    if (pad.triggerMode === 'toggle' && engineRef.current.isPlaying(padId)) {
      engineRef.current.fadeOut(padId, settings.globalFadeMs)
      setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
      return
    }

    setPadLiveState(padId, { status: 'loading', startedAt: null, error: null })
    const db = await openFileExplorerDB()
    const blob = await getFileBlob(db, pad.asset.assetId)
    const source = blob
      ? { blob, revoke: () => undefined }
      : await (async () => {
          const fileSource = await getFileSource(db, pad.asset.assetId, pad.asset.mimeType)
          if (!fileSource) return null
          const response = await fetch(fileSource.url)
          return { blob: await response.blob(), revoke: fileSource.revoke }
        })()

    if (!source) {
      setPadLiveState(padId, { status: 'error', startedAt: null, error: 'Audio file is missing' })
      return
    }

    try {
      const buffer = await engineRef.current.load(pad.asset.assetId, source.blob)
      if (pad.triggerMode === 'one-shot') engineRef.current.stop(padId)
      engineRef.current.play({ padId, buffer, loop: pad.loop, volume: pad.volume })
      setPadLiveState(padId, { status: 'playing', startedAt: Date.now(), error: null })
    } finally {
      source.revoke()
    }
  }, [setPadLiveState, settings.globalFadeMs])

  const releasePad = useCallback((padId: string): void => {
    const pad = useSoundboardStore.getState().getSelectedScene()?.pads[padId]
    if (pad?.triggerMode !== 'hold') return
    engineRef.current?.fadeOut(padId, settings.globalFadeMs)
    setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
  }, [setPadLiveState, settings.globalFadeMs])
```

Pass handlers:

```tsx
<SoundboardGrid onTriggerPad={(padId) => void triggerPad(padId)} onReleasePad={releasePad} />
```

- [ ] **Step 5: Run audio test**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/soundboard-audio.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/soundboard-audio.ts src/renderer/src/lib/__tests__/soundboard-audio.test.ts src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx
git commit -m "feat: add soundboard playback engine"
```

---

### Task 6: Add Mixer and Global Controls

**Files:**
- Create: `src/renderer/src/components/Control/Soundboard/SoundboardMixer.tsx`
- Modify: `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`
- Test: `src/renderer/src/components/Control/Soundboard/__tests__/SoundboardMixer.test.tsx`

- [ ] **Step 1: Write mixer test**

Create `src/renderer/src/components/Control/Soundboard/__tests__/SoundboardMixer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SoundboardMixer from '@renderer/components/Control/Soundboard/SoundboardMixer'
import { useSoundboardStore } from '@renderer/stores/soundboard'

it('updates master volume and exposes stop controls', async () => {
  const user = userEvent.setup()
  const stopAll = vi.fn()
  const fadeAll = vi.fn()
  render(<SoundboardMixer onStopAll={stopAll} onFadeAll={fadeAll} />)

  await user.clear(screen.getByLabelText(/master volume/i))
  await user.type(screen.getByLabelText(/master volume/i), '25')
  await user.click(screen.getByRole('button', { name: /stop all/i }))
  await user.click(screen.getByRole('button', { name: /fade all/i }))

  expect(useSoundboardStore.getState().settings.masterVolume).toBe(0.25)
  expect(stopAll).toHaveBeenCalled()
  expect(fadeAll).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/src/components/Control/Soundboard/__tests__/SoundboardMixer.test.tsx
```

Expected: FAIL because `SoundboardMixer` does not exist.

- [ ] **Step 3: Implement mixer**

Create `src/renderer/src/components/Control/Soundboard/SoundboardMixer.tsx`:

```tsx
import { Square, Volume2 } from 'lucide-react'
import { useSoundboardStore } from '@renderer/stores/soundboard'

interface SoundboardMixerProps {
  onStopAll: () => void
  onFadeAll: () => void
}

export default function SoundboardMixer({
  onStopAll,
  onFadeAll
}: SoundboardMixerProps): React.JSX.Element {
  const masterVolume = useSoundboardStore((state) => state.settings.masterVolume)
  const setMasterVolume = useSoundboardStore((state) => state.setMasterVolume)

  return (
    <footer className="flex items-center gap-3 border-t border-border bg-surface px-3 py-2">
      <label className="flex items-center gap-2 text-xs font-medium">
        <Volume2 className="size-4" />
        Master volume
        <input
          aria-label="Master volume"
          type="number"
          min={0}
          max={100}
          value={Math.round(masterVolume * 100)}
          onChange={(event) => setMasterVolume(Number(event.target.value) / 100)}
          className="w-16 rounded-md border border-border bg-background px-2 py-1"
        />
      </label>
      <button
        type="button"
        onClick={onStopAll}
        className="ml-auto inline-flex items-center gap-2 rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-white"
      >
        <Square className="size-4" />
        Stop All
      </button>
      <button
        type="button"
        onClick={onFadeAll}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold"
      >
        Fade All
      </button>
    </footer>
  )
}
```

- [ ] **Step 4: Wire mixer controls**

In `SoundboardPageContent.tsx`, import `SoundboardMixer` and add:

```tsx
  const stopAll = useCallback((): void => {
    engineRef.current?.stopAll()
    for (const padId of Object.keys(useSoundboardStore.getState().live)) {
      setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
    }
  }, [setPadLiveState])

  const fadeAll = useCallback((): void => {
    const live = useSoundboardStore.getState().live
    for (const padId of Object.keys(live)) {
      engineRef.current?.fadeOut(padId, settings.globalFadeMs)
      setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
    }
  }, [setPadLiveState, settings.globalFadeMs])
```

Add below the main content row:

```tsx
<SoundboardMixer onStopAll={stopAll} onFadeAll={fadeAll} />
```

- [ ] **Step 5: Run test**

Run:

```bash
npx vitest run src/renderer/src/components/Control/Soundboard/__tests__/SoundboardMixer.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Control/Soundboard/SoundboardMixer.tsx src/renderer/src/components/Control/Soundboard/__tests__/SoundboardMixer.test.tsx src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx
git commit -m "feat: add soundboard mixer controls"
```

---

### Task 7: Add Board and Scene Management

**Files:**
- Modify: `src/renderer/src/stores/soundboard.ts`
- Create: `src/renderer/src/components/Control/Soundboard/SoundboardTopBar.tsx`
- Modify: `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`
- Test: `src/renderer/src/stores/__tests__/soundboard-scenes.test.ts`

- [ ] **Step 1: Write board/scene tests**

Create `src/renderer/src/stores/__tests__/soundboard-scenes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { createDefaultSoundboardBoard, useSoundboardStore } from '@renderer/stores/soundboard'

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
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/soundboard-scenes.test.ts
```

Expected: FAIL because board/scene mutation methods do not exist.

- [ ] **Step 3: Add store methods**

Add to `SoundboardStore` in `src/renderer/src/stores/soundboard.ts`:

```typescript
  createBoard: (name: string) => string
  renameBoard: (boardId: string, name: string) => void
  createScene: (name: string) => string
  renameScene: (sceneId: string, name: string) => void
  duplicateScene: (sceneId: string) => string | null
  deleteScene: (sceneId: string) => void
```

Add implementations:

```typescript
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
          return { boards: { ...state.boards, [boardId]: { ...board, name: name.trim() || board.name } } }
        }),
      createScene: (name) => {
        const scene = { ...createDefaultScene(), id: crypto.randomUUID(), name: name.trim() || 'Untitled Scene' }
        set((state) => {
          const board = state.boards[state.selectedBoardId]
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
        set((state) =>
          withSelectedScene(state, (scene) =>
            scene.id === sceneId ? { ...scene, name: name.trim() || scene.name } : scene
          )
        ),
      duplicateScene: (sceneId) => {
        const state = get()
        const board = state.boards[state.selectedBoardId]
        const scene = board.scenes[sceneId]
        if (!scene) return null
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
            selectedSceneId: state.selectedSceneId === sceneId ? sceneOrder[0] : state.selectedSceneId
          }
        }),
```

- [ ] **Step 4: Create top bar**

Create `src/renderer/src/components/Control/Soundboard/SoundboardTopBar.tsx`:

```tsx
import { Plus } from 'lucide-react'
import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardTopBar(): React.JSX.Element {
  const boards = useSoundboardStore((state) => state.boards)
  const boardOrder = useSoundboardStore((state) => state.boardOrder)
  const selectedBoardId = useSoundboardStore((state) => state.selectedBoardId)
  const selectedSceneId = useSoundboardStore((state) => state.selectedSceneId)
  const selectBoard = useSoundboardStore((state) => state.selectBoard)
  const selectScene = useSoundboardStore((state) => state.selectScene)
  const createBoard = useSoundboardStore((state) => state.createBoard)
  const createScene = useSoundboardStore((state) => state.createScene)
  const board = boards[selectedBoardId]

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
      <select
        aria-label="Board"
        value={selectedBoardId}
        onChange={(event) => selectBoard(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        {boardOrder.map((boardId) => (
          <option key={boardId} value={boardId}>{boards[boardId].name}</option>
        ))}
      </select>
      <button type="button" aria-label="Add board" onClick={() => selectBoard(createBoard('New Board'))}>
        <Plus className="size-4" />
      </button>
      <select
        aria-label="Scene"
        value={selectedSceneId}
        onChange={(event) => selectScene(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
      >
        {board.sceneOrder.map((sceneId) => (
          <option key={sceneId} value={sceneId}>{board.scenes[sceneId].name}</option>
        ))}
      </select>
      <button type="button" aria-label="Add scene" onClick={() => selectScene(createScene('New Scene'))}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Wire top bar**

Replace the existing header block in `SoundboardPageContent.tsx` with:

```tsx
<SoundboardTopBar />
```

Import:

```tsx
import SoundboardTopBar from '@renderer/components/Control/Soundboard/SoundboardTopBar'
```

- [ ] **Step 6: Run test**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/soundboard-scenes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/stores/soundboard.ts src/renderer/src/stores/__tests__/soundboard-scenes.test.ts src/renderer/src/components/Control/Soundboard/SoundboardTopBar.tsx src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx
git commit -m "feat: add soundboard boards and scenes"
```

---

### Task 8: Add MIDI Input and Learn Mapping

**Files:**
- Create: `src/renderer/src/lib/soundboard-midi.ts`
- Modify: `src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx`
- Modify: `src/renderer/src/components/Control/Soundboard/SoundboardInspector.tsx`
- Test: `src/renderer/src/lib/__tests__/soundboard-midi.test.ts`

- [ ] **Step 1: Write MIDI parser tests**

Create `src/renderer/src/lib/__tests__/soundboard-midi.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { parseMidiMessage } from '@renderer/lib/soundboard-midi'

describe('parseMidiMessage', () => {
  it('normalizes note on, note off, and cc messages', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 36, 127]))).toEqual({
      type: 'note-on',
      channel: 1,
      note: 36,
      velocity: 127
    })
    expect(parseMidiMessage(new Uint8Array([0x90, 36, 0]))).toEqual({
      type: 'note-off',
      channel: 1,
      note: 36,
      velocity: 0
    })
    expect(parseMidiMessage(new Uint8Array([0xb0, 1, 64]))).toEqual({
      type: 'cc',
      channel: 1,
      controller: 1,
      value: 64
    })
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/soundboard-midi.test.ts
```

Expected: FAIL because `soundboard-midi.ts` does not exist.

- [ ] **Step 3: Implement MIDI helpers**

Create `src/renderer/src/lib/soundboard-midi.ts`:

```typescript
export type SoundboardMidiMessage =
  | { type: 'note-on'; channel: number; note: number; velocity: number }
  | { type: 'note-off'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; controller: number; value: number }

export interface SoundboardMidiInputInfo {
  id: string
  name: string
}

export function parseMidiMessage(data: Uint8Array): SoundboardMidiMessage | null {
  const status = data[0]
  const command = status & 0xf0
  const channel = (status & 0x0f) + 1

  if (command === 0x90) {
    const note = data[1]
    const velocity = data[2]
    return velocity === 0
      ? { type: 'note-off', channel, note, velocity }
      : { type: 'note-on', channel, note, velocity }
  }

  if (command === 0x80) {
    return { type: 'note-off', channel, note: data[1], velocity: data[2] }
  }

  if (command === 0xb0) {
    return { type: 'cc', channel, controller: data[1], value: data[2] }
  }

  return null
}

export async function requestMidiAccess(): Promise<MIDIAccess | null> {
  if (!navigator.requestMIDIAccess) return null
  return navigator.requestMIDIAccess()
}

export function listMidiInputs(access: MIDIAccess): SoundboardMidiInputInfo[] {
  return [...access.inputs.values()].map((input) => ({
    id: input.id,
    name: input.name || input.id
  }))
}

export function ccValueToVolume(value: number): number {
  return Math.min(1, Math.max(0, value / 127))
}
```

- [ ] **Step 4: Wire MIDI trigger handling**

In `SoundboardPageContent.tsx`, import:

```tsx
import { parseMidiMessage, requestMidiAccess, ccValueToVolume } from '@renderer/lib/soundboard-midi'
```

Add an effect:

```tsx
  useEffect(() => {
    if (!settings.midiEnabled) return
    let access: MIDIAccess | null = null

    void requestMidiAccess().then((nextAccess) => {
      access = nextAccess
      if (!access) return

      for (const input of access.inputs.values()) {
        input.onmidimessage = (event) => {
          const message = parseMidiMessage(event.data)
          if (!message) return
          const state = useSoundboardStore.getState()
          const scene = state.getSelectedScene()
          if (!scene) return

          for (const pad of Object.values(scene.pads)) {
            if (
              message.type === 'note-on' &&
              pad.midiNote?.inputId === input.id &&
              pad.midiNote.channel === message.channel &&
              pad.midiNote.note === message.note
            ) {
              void triggerPad(pad.id)
            }
            if (
              message.type === 'cc' &&
              pad.midiVolume?.inputId === input.id &&
              pad.midiVolume.channel === message.channel &&
              pad.midiVolume.controller === message.controller
            ) {
              state.updatePad(pad.id, { volume: ccValueToVolume(message.value) })
            }
          }
        }
      }
    })

    return () => {
      if (!access) return
      for (const input of access.inputs.values()) input.onmidimessage = null
    }
  }, [settings.midiEnabled, triggerPad])
```

- [ ] **Step 5: Add manual MIDI mapping inputs to inspector**

In `SoundboardInspector.tsx`, add two number inputs:

```tsx
      <label className="grid gap-1 text-xs font-medium">
        MIDI note
        <input
          aria-label="MIDI note"
          type="number"
          min={0}
          max={127}
          value={pad.midiNote?.note ?? ''}
          onChange={(event) =>
            updatePad(pad.id, {
              midiNote: event.target.value
                ? { inputId: 'default', channel: 1, note: Number(event.target.value) }
                : null
            })
          }
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        MIDI volume CC
        <input
          aria-label="MIDI volume CC"
          type="number"
          min={0}
          max={127}
          value={pad.midiVolume?.controller ?? ''}
          onChange={(event) =>
            updatePad(pad.id, {
              midiVolume: event.target.value
                ? { inputId: 'default', channel: 1, controller: Number(event.target.value) }
                : null
            })
          }
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </label>
```

- [ ] **Step 6: Run MIDI test**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/soundboard-midi.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/lib/soundboard-midi.ts src/renderer/src/lib/__tests__/soundboard-midi.test.ts src/renderer/src/components/Control/Soundboard/SoundboardPageContent.tsx src/renderer/src/components/Control/Soundboard/SoundboardInspector.tsx
git commit -m "feat: add soundboard midi input"
```

---

### Task 9: Add Soundboard Preferences

**Files:**
- Create: `src/renderer/src/components/Control/UserMenu/SoundboardSettings.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Test: `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`

- [ ] **Step 1: Add preferences test**

Update `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`:

```tsx
it('opens soundboard preferences', async () => {
  const user = userEvent.setup()
  render(<PreferencesDialog isOpen onOpenChange={vi.fn()} />)

  await user.click(screen.getByTestId('category-soundboard'))

  expect(screen.getByLabelText(/default trigger mode/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/global fade/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: FAIL because the Soundboard category does not exist.

- [ ] **Step 3: Create Soundboard settings panel**

Create `src/renderer/src/components/Control/UserMenu/SoundboardSettings.tsx`:

```tsx
import { useSoundboardStore } from '@renderer/stores/soundboard'
import type { SoundboardTriggerMode } from '@renderer/types/soundboard'

const TRIGGER_MODES: SoundboardTriggerMode[] = ['one-shot', 'toggle', 'hold']

export default function SoundboardSettings(): React.JSX.Element {
  const settings = useSoundboardStore((state) => state.settings)
  const setDefaultTriggerMode = useSoundboardStore((state) => state.setDefaultTriggerMode)
  const setGlobalFadeMs = useSoundboardStore((state) => state.setGlobalFadeMs)
  const setMasterVolume = useSoundboardStore((state) => state.setMasterVolume)
  const setMidiEnabled = useSoundboardStore((state) => state.setMidiEnabled)

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-default-200 p-4">
        <h2 className="text-sm font-semibold">Playback</h2>
        <label className="grid gap-1 text-sm">
          Default trigger mode
          <select
            aria-label="Default trigger mode"
            value={settings.defaultTriggerMode}
            onChange={(event) => setDefaultTriggerMode(event.target.value as SoundboardTriggerMode)}
            className="rounded-md border border-border bg-background px-2 py-1"
          >
            {TRIGGER_MODES.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Global fade
          <input
            aria-label="Global fade"
            type="number"
            min={0}
            value={settings.globalFadeMs}
            onChange={(event) => setGlobalFadeMs(Number(event.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Master volume
          <input
            aria-label="Master volume default"
            type="number"
            min={0}
            max={100}
            value={Math.round(settings.masterVolume * 100)}
            onChange={(event) => setMasterVolume(Number(event.target.value) / 100)}
            className="rounded-md border border-border bg-background px-2 py-1"
          />
        </label>
      </section>
      <section className="space-y-3 rounded-2xl border border-default-200 p-4">
        <h2 className="text-sm font-semibold">MIDI</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.midiEnabled}
            onChange={(event) => setMidiEnabled(event.target.checked)}
          />
          Enable MIDI
        </label>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Wire PreferencesDialog**

In `PreferencesDialog.tsx`, import:

```typescript
import { SlidersHorizontal } from 'lucide-react'
import SoundboardSettings from '@renderer/components/Control/UserMenu/SoundboardSettings'
```

Extend types:

```typescript
type Category = 'general' | 'timer' | 'bible' | 'media' | 'soundboard'
type PreferenceRoute = 'general' | 'timer' | 'bible' | 'soundboard' | `media.${MediaSettingsSection}`
```

Add category:

```typescript
  {
    id: 'soundboard',
    icon: SlidersHorizontal,
    labelKey: 'preferences.categories.soundboard',
    route: 'soundboard'
  },
```

Add render branch:

```tsx
{activeRoute === 'soundboard' && <SoundboardSettings />}
```

- [ ] **Step 5: Add locale labels**

Add to `preferences.categories`:

```json
"soundboard": "Soundboard"
```

Use `"soundboard": "音效板"` in Chinese locales.

- [ ] **Step 6: Run test**

Run:

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/Control/UserMenu/SoundboardSettings.tsx src/renderer/src/components/Control/UserMenu/PreferencesDialog.tsx src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
git commit -m "feat: add soundboard preferences"
```

---

### Task 10: Add Missing File State and Asset Deletion Warning

**Files:**
- Modify: `src/renderer/src/stores/soundboard.ts`
- Modify: `src/renderer/src/pages/FilesPage.tsx`
- Test: `src/renderer/src/stores/__tests__/soundboard-assets.test.ts`

- [ ] **Step 1: Write asset usage tests**

Create `src/renderer/src/stores/__tests__/soundboard-assets.test.ts`:

```typescript
import { createDefaultSoundboardBoard, useSoundboardStore } from '@renderer/stores/soundboard'

it('finds pads using an asset', () => {
  const board = createDefaultSoundboardBoard()
  const scene = board.scenes[board.sceneOrder[0]]
  scene.pads['pad-1-1'].asset = {
    assetId: 'file-1',
    name: 'Rain',
    mimeType: 'audio/mpeg',
    size: 1
  }

  useSoundboardStore.setState({
    boards: { [board.id]: board },
    boardOrder: [board.id],
    selectedBoardId: board.id,
    selectedSceneId: board.sceneOrder[0]
  })

  expect(useSoundboardStore.getState().findPadsUsingAsset('file-1')).toEqual([
    { boardId: board.id, sceneId: scene.id, padId: 'pad-1-1' }
  ])
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/soundboard-assets.test.ts
```

Expected: FAIL because `findPadsUsingAsset` does not exist.

- [ ] **Step 3: Add asset usage lookup**

In `src/renderer/src/stores/soundboard.ts`, add:

```typescript
export interface SoundboardAssetUsage {
  boardId: string
  sceneId: string
  padId: string
}
```

Add to store interface:

```typescript
  findPadsUsingAsset: (assetId: string) => SoundboardAssetUsage[]
```

Add implementation:

```typescript
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
```

- [ ] **Step 4: Warn before deleting used audio assets**

In `src/renderer/src/pages/FilesPage.tsx`, import:

```typescript
import { useSoundboardStore } from '@renderer/stores/soundboard'
```

Inside `handleDelete`, before the existing confirm call, add:

```typescript
      const soundboardUsageCount = [...targetIds].reduce(
        (count, id) => count + useSoundboardStore.getState().findPadsUsingAsset(id).length,
        0
      )
```

Change the confirm `description`:

```typescript
        description:
          soundboardUsageCount > 0
            ? `${soundboardUsageCount} soundboard pad(s) use the selected audio. Deleting will leave them missing.`
            : t('folder.deleteItemDescription', 'This action cannot be undone.'),
```

- [ ] **Step 5: Run test**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/soundboard-assets.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/stores/soundboard.ts src/renderer/src/pages/FilesPage.tsx src/renderer/src/stores/__tests__/soundboard-assets.test.ts
git commit -m "feat: warn when deleting soundboard assets"
```

---

### Task 11: Add Architecture Documentation

**Files:**
- Create: `docs/soundboard-architecture.md`

- [ ] **Step 1: Create architecture doc**

Create `docs/soundboard-architecture.md`:

```markdown
# Soundboard Architecture

Soundboard is a renderer-owned live audio cue workspace. It intentionally does not integrate with the projection window.

## State

`src/renderer/src/stores/soundboard.ts` stores boards, scenes, pads, persistent settings, and selected UI state. Live playback state is kept in the store for rendering indicators but is excluded from persistence.

## Assets

Soundboard reuses File Explorer media storage. Pads store a canonical `assetId` that points at a `FileItemRecord`; they do not duplicate blobs or native files. Audio support is registered in `media-capabilities.ts`, so upload validation, native filesystem storage, IndexedDB storage, and cleanup behavior stay shared.

## Playback

`src/renderer/src/lib/soundboard-audio.ts` wraps Web Audio. It supports decoded-buffer caching, polyphonic playback, per-pad gain, master gain, loop, stop, and fade out. Electron and browser use the same playback path.

## MIDI

`src/renderer/src/lib/soundboard-midi.ts` uses Web MIDI when available. MIDI is optional; unsupported or denied MIDI must not block mouse playback.

## Non-Goals

- Timeline editing
- Recording
- Transcoding
- Projection output
- MIDI output or pad LED feedback
- MIDI clock, sync, or transport
```

- [ ] **Step 2: Commit**

```bash
git add docs/soundboard-architecture.md
git commit -m "docs: document soundboard architecture"
```

---

### Task 12: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused Soundboard tests**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/media-capabilities.test.ts src/renderer/src/lib/__tests__/upload-utils.test.ts src/renderer/src/lib/__tests__/soundboard-audio.test.ts src/renderer/src/lib/__tests__/soundboard-midi.test.ts src/renderer/src/stores/__tests__/soundboard.test.ts src/renderer/src/stores/__tests__/soundboard-scenes.test.ts src/renderer/src/stores/__tests__/soundboard-assets.test.ts src/renderer/src/components/Control/Soundboard/__tests__/SoundboardGrid.test.tsx src/renderer/src/components/Control/Soundboard/__tests__/SoundboardAssignment.test.tsx src/renderer/src/components/Control/Soundboard/__tests__/SoundboardMixer.test.tsx src/renderer/src/__tests__/router.test.tsx src/renderer/src/components/Control/__tests__/Sidebar.test.tsx src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run project quality gates**

Run:

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Manual browser/electron checks**

Run Electron:

```bash
npm run dev
```

Expected:
- Soundboard appears in sidebar.
- `/soundboard` opens.
- Edit mode shows audio library and inspector.
- Uploading an MP3 stores it in Files and lets a pad reference it.
- Clicking a pad plays audio.
- Stop All stops active pads.
- Fade All fades active pads.
- Preferences opens Soundboard settings.

Open browser mode at the Vite URL printed by `npm run dev`.

Expected:
- Soundboard opens in browser.
- Mouse playback works.
- MIDI controls are absent or permission-gated when Web MIDI is unsupported.

- [ ] **Step 4: Commit final fixes if needed**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: harden soundboard verification"
```

If no fixes were required, do not create an empty commit.

## Self-Review

- Spec coverage: top-level nav/route, 8x8 grid, boards/scenes, asset assignment, upload, mouse playback, MIDI note/CC mapping, trigger modes, loop, master/per-pad volume, Stop All, Fade All, preferences, Electron/web behavior, missing-file warning, and docs are covered.
- Intentionally deferred: MIDI output/LED feedback, transport/sync, recording, waveform editing, transcoding, multi-output routing, cloud sync, projection integration, and mapping import/export.
- Placeholder scan: this plan uses concrete files, test code, implementation snippets, commands, and expected results. No banned placeholder phrase, open-ended validation step, or future-only implementation step remains.
- Type consistency: `SoundboardPad`, `SoundboardScene`, `SoundboardBoard`, `SoundboardSettings`, `SoundboardAudioEngine`, and MIDI mapping names are consistent across tasks.
