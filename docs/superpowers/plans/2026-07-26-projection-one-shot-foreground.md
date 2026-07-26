# Projection One-shot Foreground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Electron projection window to the desktop foreground exactly once for explicit Timer, Bible, and Media output commands without stealing focus or reacting to passive timer/playback updates.

**Architecture:** `WindowManager` owns the native z-order operation and exposes it through one main-window-only IPC invoke channel. `ProjectionContext` provides the dual-mode boundary: Electron invokes the preload method, browser mode is a no-op, explicit starts foreground by default, and incremental content changes must opt in. Timer Space and Media navigation reuse these explicit command paths; transport-only updates never foreground.

**Tech Stack:** Electron 39 `BrowserWindow`, typed IPC/preload bridge, React 19 context, Zustand 5, TypeScript 5.9, Vitest 4, Testing Library.

## Global Constraints

- Never call `setAlwaysOnTop()`, `focus()`, or activating `show()` for this feature.
- Use `restore()` only when minimized, `showInactive()` only when hidden, and `moveTop()` once per accepted request.
- Browser mode must not call `window.focus()` or any native z-order API.
- `timer:tick`, stopwatch ticks, pan, zoom, playback state, readiness messages, and component remounts must not foreground projection.
- Page navigation and `claimProjection()` retain the existing projection owner rule and do not foreground projection.
- A foreground failure must not cancel content delivery, Timer operation, or Media navigation.
- Follow project style: no semicolons, single quotes, 100-column print width, no trailing commas, no `as any`, and no new dependencies.

---

### Task 1: Native one-shot foreground operation

**Files:**
- Modify: `src/main/windowManager.ts`
- Modify: `src/main/__tests__/windowManager.test.ts`

**Interfaces:**
- Consumes: the existing `WindowManager.projectionWindow: BrowserWindow | null`
- Produces: `WindowManager.bringProjectionToFront(): boolean`

- [ ] **Step 1: Replace the minimal BrowserWindow mock with a controllable fake**

Create a fake that records `isDestroyed`, `isMinimized`, `isVisible`, `restore`, `showInactive`,
`moveTop`, `focus`, `show`, and `setAlwaysOnTop`, and stores `once()` handlers so
`ready-to-show` can be emitted after `createProjectionWindow()`.

The fake must also implement the existing methods used by `createProjectionWindow()`, `cleanup()`,
and `closeProjection()`:

```ts
class FakeBrowserWindow {
  static instances: FakeBrowserWindow[] = []
  webContents = {
    setWindowOpenHandler: vi.fn(),
    on: vi.fn(),
    send: vi.fn()
  }
  loadURL = vi.fn(() => Promise.resolve())
  loadFile = vi.fn(() => Promise.resolve())
  once = vi.fn((event: string, handler: () => void) => {
    this.onceHandlers.set(event, handler)
  })
  on = vi.fn()
  isDestroyed = vi.fn(() => false)
  isMinimized = vi.fn(() => false)
  isVisible = vi.fn(() => true)
  restore = vi.fn()
  showInactive = vi.fn()
  moveTop = vi.fn()
  focus = vi.fn()
  show = vi.fn()
  setAlwaysOnTop = vi.fn()
  close = vi.fn()
  destroy = vi.fn()
  private onceHandlers = new Map<string, () => void>()

  constructor() {
    FakeBrowserWindow.instances.push(this)
  }

  emitOnce(event: string): void {
    this.onceHandlers.get(event)?.()
  }
}
```

- [ ] **Step 2: Write failing WindowManager behavior tests**

Add tests that create a projection window, clear creation calls, configure the fake, and assert:

```ts
expect(wm.bringProjectionToFront()).toBe(true)
expect(projection.moveTop).toHaveBeenCalledOnce()
expect(projection.focus).not.toHaveBeenCalled()
expect(projection.show).not.toHaveBeenCalled()
expect(projection.setAlwaysOnTop).not.toHaveBeenCalled()
```

Add independent cases for:

```ts
projection.isMinimized.mockReturnValue(true)
expect(projection.restore).toHaveBeenCalledOnce()
expect(projection.restore.mock.invocationCallOrder[0]).toBeLessThan(
  projection.moveTop.mock.invocationCallOrder[0]
)
```

```ts
projection.isVisible.mockReturnValue(false)
expect(projection.showInactive).toHaveBeenCalledOnce()
```

Also assert missing/destroyed projection returns `false`, and emitting `ready-to-show` on a newly
created projection invokes the same non-activating foreground behavior exactly once.

- [ ] **Step 3: Run the WindowManager tests and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: FAIL because `bringProjectionToFront` does not exist and `ready-to-show` only calls
`showInactive()`.

- [ ] **Step 4: Implement the minimal native method**

Add:

```ts
bringProjectionToFront(): boolean {
  const projectionWindow = this.projectionWindow
  if (!projectionWindow || projectionWindow.isDestroyed()) return false

  try {
    if (projectionWindow.isMinimized()) projectionWindow.restore()
    if (!projectionWindow.isVisible()) projectionWindow.showInactive()
    projectionWindow.moveTop()
    return true
  } catch (error) {
    console.warn('Failed to bring projection window to front:', error)
    return false
  }
}
```

Replace the creation listener with:

```ts
projectionWindow.once('ready-to-show', () => {
  if (this.projectionWindow !== projectionWindow) return
  this.bringProjectionToFront()
})
```

- [ ] **Step 5: Run the WindowManager tests and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: PASS with no focus or always-on-top calls.

- [ ] **Step 6: Commit the native operation**

```bash
git add src/main/windowManager.ts src/main/__tests__/windowManager.test.ts
git commit -m "feat: add one-shot projection foreground operation"
```

### Task 2: Typed main-window-only foreground IPC

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/main/ipc/projection.ts`
- Modify: `src/main/__tests__/ipc/projection.test.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

**Interfaces:**
- Consumes: `WindowManager.bringProjectionToFront(): boolean`
- Produces:

```ts
'projection:bring-to-front': {
  args: []
  result: { broughtToFront: boolean }
}
```

```ts
window.api.projection.bringToFront(): Promise<{ broughtToFront: boolean }>
```

- [ ] **Step 1: Write failing IPC authorization tests**

Add `bringProjectionToFront: vi.fn()` to the mock manager, then test:

```ts
describe('projection:bring-to-front', () => {
  it('allows the main window to bring projection forward', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    mockWindowManager.bringProjectionToFront.mockReturnValue(true)

    expect(getHandler('projection:bring-to-front')(makeEvent())).toEqual({
      broughtToFront: true
    })
    expect(mockWindowManager.bringProjectionToFront).toHaveBeenCalledOnce()
  })

  it('rejects projection and unknown windows', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    expect(getHandler('projection:bring-to-front')(makeEvent())).toEqual({
      broughtToFront: false
    })
    expect(mockWindowManager.bringProjectionToFront).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the IPC test and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/ipc/projection.test.ts
```

Expected: FAIL because the handler is not registered.

- [ ] **Step 3: Add the typed channel, handler, and preload API**

Add to `IpcInvokeMap`:

```ts
'projection:bring-to-front': { args: []; result: { broughtToFront: boolean } }
```

Register:

```ts
ipcMain.handle('projection:bring-to-front', (event) => {
  if (!isMainWindow(windowManager, event)) return { broughtToFront: false }
  return { broughtToFront: windowManager.bringProjectionToFront() }
})
```

Expose:

```ts
bringToFront: () => typedInvoke('projection:bring-to-front')
```

and add the identical result type to `ProjectionAPI` in `src/preload/index.d.ts`.

- [ ] **Step 4: Run IPC and node type checks**

Run:

```bash
npx vitest run src/main/__tests__/ipc/projection.test.ts
npm run typecheck:node
```

Expected: PASS.

- [ ] **Step 5: Commit the IPC boundary**

```bash
git add src/shared/ipc-channels.ts src/main/ipc/projection.ts \
  src/main/__tests__/ipc/projection.test.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: expose projection foreground IPC"
```

### Task 3: Dual-mode foreground intent in ProjectionContext

**Files:**
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`

**Interfaces:**
- Consumes: `window.api.projection.bringToFront()`
- Produces:

```ts
interface StartProjectionOptions {
  bringToFront?: boolean
}

interface ProjectOptions {
  autoOpen?: boolean
  bringToFront?: boolean
}

bringProjectionToFront(): Promise<void>
```

`startProjection(owner, payloads, options)` defaults to one-shot foreground for an already-open
Electron projection. Passing `{ bringToFront: false }` is required for remount/session replay.

- [ ] **Step 1: Extend the Electron test fixture with a foreground mock**

Add:

```ts
let mockBringToFront: ReturnType<typeof vi.fn>

mockBringToFront = vi.fn(() => Promise.resolve({ broughtToFront: true }))
```

and expose it as `window.api.projection.bringToFront`.

- [ ] **Step 2: Write failing explicit-intent tests**

Add tests that:

- set `mockCheck` to `{ exists: true }`, await mount initialization, call
  `startProjection('timer', [])`, and expect one `mockBringToFront` call;
- call `startProjection('media', [], { bringToFront: false })` and expect no call;
- call `project('file:show', payload, { bringToFront: true })` and expect one call;
- call plain `project('file:show', payload)` and expect no call;
- switch `isElectron` to `false`, call start/project, and assert no preload or `window.focus()` call.

- [ ] **Step 3: Run ProjectionContext tests and verify RED**

Run:

```bash
npx vitest run src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
```

Expected: FAIL because foreground options and the context method do not exist.

- [ ] **Step 4: Implement the environment boundary**

Add:

```ts
const bringProjectionToFront = useCallback(async (): Promise<void> => {
  if (!isElectron()) return
  await window.api.projection.bringToFront().catch((error) => {
    console.warn('[Projection] Bring to front failed:', error)
  })
}, [])
```

For `startProjection`, record whether the window was already open. Queue content first, open a
closed window normally, and invoke foreground only for an existing window:

```ts
const wasOpen = isProjectionOpenRef.current
if (!wasOpen) {
  await openProjection()
} else if (options?.bringToFront !== false) {
  await bringProjectionToFront()
}
```

For `project`, send or buffer the payload first, then invoke foreground only when
`options?.bringToFront` is true. Do not let a foreground rejection reject content delivery.

Publish `bringProjectionToFront` in the memoized context value.

- [ ] **Step 5: Run context tests and web type check**

Run:

```bash
npx vitest run src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
npm run typecheck:web
```

Expected: PASS.

- [ ] **Step 6: Commit the renderer boundary**

```bash
git add src/renderer/src/contexts/ProjectionContext.tsx \
  src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
git commit -m "feat: add explicit projection foreground intent"
```

### Task 4: Timer Space start/resume parity

**Files:**
- Modify: `src/renderer/src/pages/TimerPage.tsx`
- Modify: `src/renderer/src/pages/__tests__/TimerPage.test.tsx`

**Interfaces:**
- Consumes: `startTimerProjection({ startProjection })`
- Produces: Space start/resume follows the same projection start command as Timer buttons

- [ ] **Step 1: Write failing Space shortcut tests**

Update the ProjectionContext fixture to keep a stable `mockStartProjection`. Add tests using
`userEvent.keyboard('[Space]')`:

```ts
expect(mockStartProjection).toHaveBeenCalledWith(
  'timer',
  expect.arrayContaining([['timer:tick', expect.any(Object)]])
)
expect(startSpy).toHaveBeenCalledOnce()
```

Cover both stopped and paused states. Add a running-state assertion that Space pauses and does not
start/foreground projection.

- [ ] **Step 2: Run TimerPage tests and verify RED**

Run:

```bash
npx vitest run src/renderer/src/pages/__tests__/TimerPage.test.tsx
```

Expected: FAIL because Space directly invokes the Timer store and never starts projection.

- [ ] **Step 3: Route Space through the shared projection action**

Import `startTimerProjection`, read `startProjection` from `useProjection()`, and change the
shortcut:

```ts
const { claimProjection, isProjectionOpen, startProjection } = useProjection()

handler: () => {
  const { status, start, pause } = useTimerStore.getState()
  if (status === 'running') {
    pause()
    return
  }

  void startTimerProjection({ startProjection })
  if (status === 'stopped' || status === 'paused') start()
}
```

Keep using the store's existing `start()` operation for both stopped and paused state. The
`TimerEngineProvider` already translates the paused-to-running transition into the adapter's
`resume` command.

- [ ] **Step 4: Run Timer tests and verify GREEN**

Run:

```bash
npx vitest run src/renderer/src/pages/__tests__/TimerPage.test.tsx
npx vitest run src/renderer/src/components/Control/Timer/__tests__/TimerControls.test.tsx
```

Expected: PASS. No tick-driven code contains a foreground call.

- [ ] **Step 5: Commit Timer parity**

```bash
git add src/renderer/src/pages/TimerPage.tsx \
  src/renderer/src/pages/__tests__/TimerPage.test.tsx
git commit -m "fix: align timer Space projection behavior"
```

### Task 5: Explicit Media navigation foreground behavior

**Files:**
- Modify: `src/renderer/src/lib/media-projection-sync.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-sync.test.ts`

**Interfaces:**
- Consumes:
  - `startProjection(owner, payloads, options?)`
  - `project(channel, payload, { bringToFront?: boolean })`
- Produces:
  - explicit start/index/presentation-slide changes request foreground;
  - pan/zoom/playback/remount synchronization does not.

- [ ] **Step 1: Write failing Media intent tests**

Change existing explicit assertions to:

```ts
expect(mockProject).toHaveBeenCalledWith(
  'file:show',
  expect.objectContaining({ currentIndex: 1 }),
  { bringToFront: true }
)
```

and:

```ts
expect(mockProject).toHaveBeenCalledWith(
  'file:show',
  expect.objectContaining({ presentation: { slideIndex: 1, slideCount: 5 } }),
  { bringToFront: true }
)
```

Assert initial mount of an already-presenting session uses:

```ts
expect(mockStartProjection).toHaveBeenCalledWith(
  'media',
  expect.any(Array),
  { bringToFront: false }
)
```

Add pan/zoom assertions that no call has `{ bringToFront: true }`.

- [ ] **Step 2: Run Media sync tests and verify RED**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/media-projection-sync.test.ts
```

Expected: FAIL because current calls do not carry intent options.

- [ ] **Step 3: Add explicit foreground intent without touching transport updates**

Change the helper to:

```ts
async (
  state: MediaProjectionStore,
  startSession = false,
  bringToFront = false
): Promise<void>
```

Use:

```ts
if (startSession) {
  void startProjection(
    'media',
    [['file:show', payload]],
    { bringToFront }
  )
} else {
  void project('file:show', payload, { bringToFront })
}
```

For store subscription:

```ts
const explicitContentChange = started || indexChanged || endedCleared || presentationChanged
void projectCurrentItem(state, started, explicitContentChange)
```

For hook remount:

```ts
void projectCurrentItem(state, true, false)
```

Playlist metadata refresh alone remains a content synchronization event with
`bringToFront: false`.

- [ ] **Step 4: Run Media and Bible projection tests**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/media-projection-sync.test.ts
npx vitest run src/renderer/src/components/Control/Bible/__tests__/BiblePreview.test.tsx
npx vitest run src/renderer/src/components/Control/Bible/__tests__/CustomFolderTab.test.tsx
```

Expected: PASS. Bible uses `startProjection()` default explicit foreground semantics; no Bible
transport-only setting update requests foreground.

- [ ] **Step 5: Commit Media intent**

```bash
git add src/renderer/src/lib/media-projection-sync.ts \
  src/renderer/src/lib/__tests__/media-projection-sync.test.ts
git commit -m "feat: foreground explicit media projection changes"
```

### Task 6: Full verification and roadmap progress

**Files:**
- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`

**Interfaces:**
- Consumes: completed Tasks 1–5
- Produces: verified R0 one-shot foreground slice marked implemented

- [ ] **Step 1: Run focused regression suite**

```bash
npx vitest run \
  src/main/__tests__/windowManager.test.ts \
  src/main/__tests__/ipc/projection.test.ts \
  src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx \
  src/renderer/src/pages/__tests__/TimerPage.test.tsx \
  src/renderer/src/components/Control/Timer/__tests__/TimerControls.test.tsx \
  src/renderer/src/components/Control/Bible/__tests__/BiblePreview.test.tsx \
  src/renderer/src/components/Control/Bible/__tests__/CustomFolderTab.test.tsx \
  src/renderer/src/lib/__tests__/media-projection-sync.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all quality gates**

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
```

Expected: all commands exit `0`; build bundle budget passes.

- [ ] **Step 3: Inspect scope and forbidden calls**

```bash
git diff --check
rg -n "setAlwaysOnTop|\\.focus\\(\\)|window\\.focus" \
  src/main/windowManager.ts \
  src/renderer/src/contexts/ProjectionContext.tsx
git status --short
```

Expected: no feature implementation calls `setAlwaysOnTop`, `BrowserWindow.focus`, activating
`show`, or `window.focus`; only intended files are changed.

- [ ] **Step 4: Update R0 progress**

Mark the one-shot foreground and Timer Space sub-slice implemented while leaving browser E2E and
packaged smoke work pending:

```markdown
- [x] Electron one-shot foreground for explicit Timer, Bible, and Media output.
- [x] Timer Space start/resume parity.
- [ ] Browser projection E2E in PR CI.
- [ ] Packaged Electron projection smoke in release gates.
```

- [ ] **Step 5: Commit the verified slice**

```bash
git add docs/roadmap/librepresenter-optimization-roadmap.md
git commit -m "docs: record projection foreground milestone progress"
```
