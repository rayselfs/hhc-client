# Projection Product Flow Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make projection an output-only window while fixing first-play VLC startup, video controls,
and PDF worker/navigation regressions in Electron development and packaged macOS builds.

**Architecture:** Keep the existing projection generation/coordinator and PR #35 main-owned VLC
session. Narrow `WindowManager` to output-window lifecycle, delete content-driven foregrounding,
complete VLC play startup from the first confirming event, and separate renderer PDF worker setup
from the already-background thumbnail worker's local PDF.js handler.

**Tech Stack:** Electron 41, React 19, TypeScript 5.9, Zustand 5, pdfjs-dist 6, electron-vlc-player,
Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-projection-product-flow-design.md`

## Global Constraints

- Work only in `/Users/rayselfs/Projects/hhc/hhc-client-v2/.worktrees/projection-product-flow` on
  `fix/projection-product-flow`, based on current `origin/main`.
- Projection is output-only; the control window is the sole keyboard and mouse control surface.
- Preserve Electron/browser dual mode, projection generation/replay, explicit Timer reclaim, and the
  existing Media close transaction.
- Preserve PR #35 session ownership, attempt fencing, remux cache, watchdog, typed failures, and
  source bytes.
- Add no dependency, new persistent store, second VLC player, nested PDF worker, or replacement
  projection manager.
- Use `/Users/rayselfs/Desktop/test` read-only; do not modify, move, rename, or commit those files.
- Follow TDD for every behavior change: write one focused failing regression, observe the expected
  failure, implement the minimum fix, and rerun focused tests.
- Do not merge, tag, publish, update an updater manifest, deploy, or remove the worktree.

---

### Task 1: Make the Electron projection BrowserWindow output-only

**Files:**

- Modify: `src/main/windowManager.ts`
- Modify: `src/main/__tests__/windowManager.test.ts`

**Interfaces:**

- Consumes: existing `WindowManager.createProjectionWindow(displayId?, reason?)` and projection
  generation/lifecycle events.
- Produces: an output-only projection `BrowserWindow` shown once with `showInactive()`, with no native
  fullscreen or z-order mutation.

- [ ] **Step 1: Add a failing output-window options test**

Replace the foreground-focused assertions with a test that uses the existing external display mock:

```ts
it('creates an output-only projection at the selected display bounds', () => {
  const wm = WindowManager.getInstance()

  wm.createProjectionWindow('2')

  const projection = FakeBrowserWindow.instances[0]
  expect(projection.options).toMatchObject({
    width: 1920,
    height: 1080,
    x: 1920,
    y: 0,
    show: false,
    frame: false,
    fullscreen: false,
    focusable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    movable: false,
    resizable: false
  })
  expect(projection.setIgnoreMouseEvents).toHaveBeenCalledWith(true)
})
```

Extend `FakeBrowserWindow` with `setIgnoreMouseEvents = vi.fn()`, `setFullScreen = vi.fn()`, and
`maximize = vi.fn()` so the assertions observe the real WindowManager calls.

- [ ] **Step 2: Run the options test and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts -t "output-only projection"
```

Expected: FAIL because the current projection uses native fullscreen and remains focusable.

- [ ] **Step 3: Add failing focus and control-window independence tests**

Add tests that emit `ready-to-show` and create a main window while a second display exists:

```ts
it('shows projection without focus or z-order mutation', () => {
  const wm = WindowManager.getInstance()
  wm.createProjectionWindow('2')
  const projection = FakeBrowserWindow.instances[0]

  projection.emitOnce('ready-to-show')

  expect(projection.showInactive).toHaveBeenCalledOnce()
  expect(projection.focus).not.toHaveBeenCalled()
  expect(projection.moveTop).not.toHaveBeenCalled()
  expect(projection.setFullScreen).not.toHaveBeenCalled()
})

it('does not change the control window state when an external display exists', () => {
  const wm = WindowManager.getInstance()
  wm.createMainWindow()
  const control = FakeBrowserWindow.instances[0]

  control.emitOnce('ready-to-show')

  expect(control.maximize).not.toHaveBeenCalled()
  expect(control.setFullScreen).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: Run the two tests and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts -t "without focus|control window state"
```

Expected: FAIL because `ready-to-show` currently calls `bringProjectionToFront()` and the control
window currently maximizes/fullscreens based on external-display presence.

- [ ] **Step 5: Implement the minimal output-only BrowserWindow policy**

In `createMainWindow()`, remove `acceptFirstMouse`, the `hasSecondScreen` branch, and the macOS/
Windows automatic fullscreen/maximize calls. Keep `show()` on `ready-to-show`.

In `createProjectionWindow()`, construct the output with:

```ts
const projectionWindow = new BrowserWindow({
  width: hasSecondScreen ? targetDisplay.bounds.width : 800,
  height: hasSecondScreen ? targetDisplay.bounds.height : 600,
  x: targetDisplay.bounds.x,
  y: targetDisplay.bounds.y,
  fullscreen: false,
  frame: false,
  focusable: false,
  fullscreenable: false,
  minimizable: false,
  maximizable: false,
  movable: false,
  resizable: false,
  show: false,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    backgroundThrottling: false
  },
  title: 'Projection'
})
projectionWindow.setIgnoreMouseEvents(true)
```

Replace the `ready-to-show` callback body with:

```ts
if (this.projectionWindow !== projectionWindow) return
projectionWindow.showInactive()
```

Do not alter generation, display move, recovery, close, or renderer-ready logic in this task.

- [ ] **Step 6: Run WindowManager tests and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
npm run typecheck:node
```

Expected: all WindowManager tests pass and the node TypeScript check succeeds.

- [ ] **Step 7: Commit the output-window boundary**

```bash
git add src/main/windowManager.ts src/main/__tests__/windowManager.test.ts
git commit -m "fix: make projection window output only"
```

---

### Task 2: Delete projection foregrounding from IPC and content flow

**Files:**

- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/ipc/projection.ts`
- Modify: `src/main/__tests__/ipc/projection.test.ts`
- Modify: `src/main/windowManager.ts`
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`
- Modify: `src/renderer/src/lib/media-projection-sync.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-sync.test.ts`
- Modify: renderer test mocks found by
  `rg -l "bringProjectionToFront|bringToFront" src/renderer/src --glob '*test.ts*'`

**Interfaces:**

- Consumes: Task 1 output-only projection lifecycle.
- Produces:
  - `startProjection(owner, payloads?)` with no foreground options;
  - `project(channel, data, { autoOpen? })` with no foreground option;
  - no `projection:bring-to-front` IPC or preload method;
  - browser popup returns focus once to the control window after creation.

- [ ] **Step 1: Change contract tests first**

Delete the `projection:bring-to-front` handler tests and add an absence assertion after handler
registration:

```ts
it('does not register a projection foreground handler', () => {
  expect(getHandler('projection:bring-to-front')).toBeUndefined()
})
```

Update Media sync expectations from:

```ts
expect(mockStartProjection).toHaveBeenCalledWith('media', expect.any(Array), {
  bringToFront: true
})
```

to:

```ts
expect(mockStartProjection).toHaveBeenCalledWith('media', expect.any(Array))
```

and update `mockProject` expectations to two arguments. Add one assertion covering item replacement,
not every existing test.

In browser ProjectionContext tests, expose `blur` on the popup mock and assert initial focus return:

```ts
expect(mockProjectionWindow.blur).toHaveBeenCalledOnce()
expect(focus).toHaveBeenCalledOnce()
```

- [ ] **Step 2: Run contract tests and verify RED**

Run:

```bash
npx vitest run \
  src/main/__tests__/ipc/projection.test.ts \
  src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx \
  src/renderer/src/lib/__tests__/media-projection-sync.test.ts
```

Expected: FAIL because foreground IPC/options still exist and browser open does not return focus.

- [ ] **Step 3: Remove the main/preload foreground API**

Delete:

```ts
'projection:bring-to-front': { args: []; result: { broughtToFront: boolean } }
```

from `IpcInvokeMap`, delete `projectionApi.bringToFront`, remove `ProjectionAPI.bringToFront`, remove
the handler from `registerProjectionHandlers`, and delete `WindowManager.bringProjectionToFront()`.

- [ ] **Step 4: Remove foreground intent from ProjectionContext**

Reduce the option type to:

```ts
interface ProjectOptions {
  autoOpen?: boolean
}
```

Delete `StartProjectionOptions`, remove the third argument from `startProjection`, remove
`bringProjectionToFront` from `ProjectionContextValue`, and delete both foreground calls. Keep
`autoOpen` behavior in `project()` unchanged.

After a successful browser `window.open`, return control focus once:

```ts
projectionWindowRef.current = win
win.blur()
window.focus()
updateOpen(true)
```

Do not focus either window during later content changes.

- [ ] **Step 5: Remove foreground intent from Media sync and test mocks**

Change `projectCurrentItem` to:

```ts
async (
  state: MediaProjectionStore,
  startSession = false,
  forceRemoteSource = false
): Promise<void>
```

Call:

```ts
if (startSession) void startProjection('media', [['file:show', payload]])
else void project('file:show', payload)
```

Remove `explicitContentChange` and every positional foreground argument. Mechanically delete obsolete
foreground members from renderer test mocks; do not touch the unrelated editable-presentation
`bring-to-front` element-order action or locale strings.

- [ ] **Step 6: Run focused contracts and verify GREEN**

Run:

```bash
npx vitest run \
  src/main/__tests__/windowManager.test.ts \
  src/main/__tests__/ipc/projection.test.ts \
  src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx \
  src/renderer/src/lib/__tests__/media-projection-sync.test.ts \
  src/renderer/src/pages/__tests__/TimerPage.test.tsx \
  src/renderer/src/components/Control/Header/__tests__/Header.test.tsx \
  src/renderer/src/components/Control/__tests__/Layout.test.tsx \
  src/renderer/src/__tests__/router.test.tsx
npm run typecheck
```

Expected: all focused tests and both TypeScript passes succeed. Confirm this search returns no
projection-window foreground API:

```bash
rg -n "projection:bring-to-front|bringProjectionToFront|bringToFront:" \
  src/main src/preload src/shared src/renderer/src/contexts src/renderer/src/lib/media-projection-sync.ts
```

Expected: no matches.

- [ ] **Step 7: Commit foreground removal**

```bash
git add src/main src/preload src/shared src/renderer/src
git commit -m "refactor: decouple content from projection window lifecycle"
```

---

### Task 3: Complete VLC immediate-play startup on the first confirming event

**Files:**

- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`

**Interfaces:**

- Consumes: existing `OwnedVlcSession`, pending transport, owner checks, and `finishStartup()`.
- Produces: first `playing` completes a no-seek pending play exactly once; seek-confirmed play can
  finish from an already-playing native player without waiting for a redundant event.

- [ ] **Step 1: Add a failing immediate-play regression**

Use the existing handler/player mock:

```ts
it('finishes a queued immediate play on the first playing event', async () => {
  await getHandler('projection-vlc:start')(makeEvent(), {
    itemId: 'item-1',
    attemptId: 'attempt-1',
    sourceFileId: '550e8400-e29b-41d4-a716-446655440000',
    container: '#vlc-player'
  })
  const current = mockVlcPlayers[0]
  getHandler('projection-vlc:control')(makeEvent(), {
    action: 'play',
    itemId: 'item-1'
  })
  mockSetPlayerWindowVisible.mockClear()
  mockWindowManager.sendToMain.mockClear()

  current.emit('playing')

  expect(current.play).toHaveBeenCalledOnce()
  expect(mockSetPlayerWindowVisible).toHaveBeenLastCalledWith(7, true)
  expect(mockWindowManager.sendToMain).toHaveBeenCalledWith(
    'projection:message',
    4,
    'file:playback-state',
    expect.objectContaining({ itemId: 'item-1', isPlaying: true, isEnded: false })
  )
})
```

- [ ] **Step 2: Run the immediate-play test and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/ipc/projection-vlc.test.ts \
  -t "queued immediate play"
```

Expected: FAIL because the current handler calls `play()` a second time and does not reveal/publish
ready state on the first event.

- [ ] **Step 3: Add a failing seek-to-play confirmation regression**

Extend the existing replay-order case after `timeChanged`:

```ts
current.getTime.mockReturnValue(18_000)
current.isPlaying.mockReturnValue(true)
current.emit('timeChanged')

expect(current.play).toHaveBeenCalledOnce()
expect(mockSetPlayerWindowVisible).toHaveBeenLastCalledWith(7, true)
```

Expected: current code calls redundant play and waits.

- [ ] **Step 4: Implement the minimal startup transition**

In the first `playing` handler, after setting readiness/seekability:

```ts
if (session.pending.seekSeconds === undefined && session.pending.transport === 'play') {
  finishStartup(wm, session, true)
  return
}
continueStartupAfterReadiness(wm, session)
```

In `applyFinalTransport()`, avoid redundant play after confirmed seek:

```ts
if (session.pending.transport === 'play') {
  try {
    if (ownerPlayer.isPlaying()) {
      finishStartup(wm, session, true)
      return
    }
  } catch {
    // Fall through to the owner-safe native play request.
  }
}
session.phase = 'waiting-transport'
runOwnedNativeAction(wm, session, (player) => {
  if (session.pending.transport === 'play') player.play()
  else player.pause()
})
```

Do not change watchdog duration, remux routing, failure codes, or ownership fences.

- [ ] **Step 5: Run the complete VLC handler suite and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/ipc/projection-vlc.test.ts
npm run typecheck:node
```

Expected: all VLC tests and node typecheck pass.

- [ ] **Step 6: Commit VLC startup correction**

```bash
git add src/main/ipc/projection-vlc.ts src/main/__tests__/ipc/projection-vlc.test.ts
git commit -m "fix: complete VLC playback on confirmed startup"
```

---

### Task 4: Make video started state monotonic and expose duration controls

**Files:**

- Modify: `src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx`
- Modify: `src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx`
- Modify:
  `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx`

**Interfaces:**

- Consumes: authoritative `file:playback-state` and item-scoped Zustand video type state.
- Produces: monotonic `hasStarted`; central overlay hidden on confirmed playback; timeline rendered once
  duration exists and disabled only by seek capability.

- [ ] **Step 1: Add a failing bridge transition test**

Extract the current video setup into the existing test or repeat its small fixture, then send two
owner-confirmed states:

```ts
act(() => {
  mocks.handlers.get('file:playback-state')?.({
    itemId: 'video-1',
    currentTime: 0,
    duration: 120,
    isPlaying: false,
    isEnded: false,
    seekable: true
  })
  mocks.handlers.get('file:playback-state')?.({
    itemId: 'video-1',
    currentTime: 0,
    duration: 120,
    isPlaying: true,
    isEnded: false,
    seekable: true
  })
})

expect(useMediaProjectionStore.getState().typeStates.video?.hasStarted).toBe(true)
```

- [ ] **Step 2: Run the bridge transition test and verify RED**

Run:

```bash
npx vitest run \
  src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx \
  -t "hasStarted"
```

Expected: FAIL because `false ?? true` remains `false`.

- [ ] **Step 3: Add failing VideoPreview availability tests**

Add one playing-state test and one metadata-before-start test:

```ts
it('hides the central button after owner-confirmed playback starts', async () => {
  const item = makeCopy('video/x-matroska', 'movie.mkv')
  storeState.typeStates.video = {
    hasStarted: true,
    isPlaying: true,
    isEnded: false,
    currentTime: 0,
    duration: 120,
    seekable: true
  }
  const { container } = render(<VideoPreview item={item} />)
  await getLoadedVideo(container)

  expect(container.querySelector('button.absolute.inset-0.flex')).toBeNull()
  expect(container.querySelector('input.video-seek-range')).toBeEnabled()
})

it('shows a disabled timeline when duration is known but seek is unavailable', async () => {
  const item = makeCopy('video/x-matroska', 'movie.mkv')
  storeState.typeStates.video = {
    hasStarted: false,
    isPlaying: false,
    isEnded: false,
    currentTime: 0,
    duration: 120,
    seekable: false
  }
  const { container } = render(<VideoPreview item={item} />)
  await getLoadedVideo(container)

  expect(container.querySelector('input.video-seek-range')).toBeDisabled()
})
```

Use an accessible role/test id instead of the CSS selector if the existing markup offers one; do not
add a production-only test hook solely for this assertion.

- [ ] **Step 4: Run VideoPreview tests and verify RED**

Run:

```bash
npx vitest run \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx \
  -t "central button|disabled timeline"
```

Expected: the metadata-before-start timeline assertion fails because controls are currently gated by
`displayedHasStarted`.

- [ ] **Step 5: Implement the two minimal UI state changes**

In `MediaProjectionBridge`, replace the nullish expression with:

```ts
hasStarted: (current?.hasStarted ?? false) || data.currentTime > 0 || data.isPlaying,
```

In `VideoPreview`, keep the central overlay gated by `!displayedHasStarted`, but render the bottom
controls when metadata exists:

```tsx
{displayedDuration > 0 && (
  <div className="absolute bottom-0 left-0 right-0 z-20" ...>
```

Keep the range's existing `disabled={!seekable}` and pending-seek logic unchanged.

- [ ] **Step 6: Run focused renderer tests and verify GREEN**

Run:

```bash
npx vitest run \
  src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx
npm run typecheck:web
```

Expected: both suites and web typecheck pass.

- [ ] **Step 7: Commit video control correction**

```bash
git add \
  src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx \
  src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx
git commit -m "fix: expose confirmed video playback controls"
```

---

### Task 5: Separate renderer PDF worker setup from background rendering

**Files:**

- Modify: `src/renderer/src/lib/pdfjs-loader.ts`
- Modify: `src/renderer/src/lib/__tests__/pdfjs-loader.test.ts`
- Modify: `src/renderer/src/workers/thumbnail-render.worker.ts`
- Modify: `src/renderer/src/workers/__tests__/thumbnail-render.worker.test.ts`

**Interfaces:**

- Consumes: emitted `pdf-worker-polyfill.worker.ts?worker&url` and official
  `WorkerMessageHandler`.
- Produces:
  - `loadPdfjsLib()` for renderer preview/projection with `GlobalWorkerOptions.workerSrc` only;
  - `loadPdfjsWorkerLib()` for the already-background thumbnail worker with the official local
    handler;
  - background `getDocument()` at `VerbosityLevel.ERRORS` while typed failures remain visible.

- [ ] **Step 1: Replace the loader test with failing environment-specific contracts**

Mock `VerbosityLevel` along with `GlobalWorkerOptions` and write:

```ts
it('configures renderer PDF.js without installing a main-thread worker handler', async () => {
  vi.stubGlobal('document', {})

  const pdfjs = await loadPdfjsLib()

  expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain('pdf-worker')
  expect((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker).toBeUndefined()
})

it('installs the official local handler only for an existing background worker', async () => {
  await loadPdfjsWorkerLib()

  expect((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker).toEqual({
    WorkerMessageHandler: workerMessageHandler
  })
})
```

Mock the emitted worker URL explicitly in `pdfjs-loader.test.ts`:

```ts
vi.mock('../pdf-worker-polyfill.worker.ts?worker&url', () => ({
  default: '/assets/pdf-worker-test.js'
}))
```

- [ ] **Step 2: Run the loader tests and verify RED**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/pdfjs-loader.test.ts
```

Expected: FAIL because there is no explicit background-worker loader and the current function chooses
behavior from global `document`.

- [ ] **Step 3: Add a failing thumbnail-worker verbosity test**

Change the test mock to export `loadPdfjsWorkerLib` and `VerbosityLevel: { ERRORS: 0 }`. Extend the
existing options assertion:

```ts
expect(options).toMatchObject({
  disableFontFace: true,
  useSystemFonts: false,
  verbosity: 0
})
```

- [ ] **Step 4: Run the thumbnail test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/workers/__tests__/thumbnail-render.worker.test.ts
```

Expected: FAIL because it still calls `loadPdfjsLib()` and does not set verbosity.

- [ ] **Step 5: Implement explicit PDF.js loaders**

Keep the existing Map/Math polyfills in one private `installPdfjsPolyfills()` function. Implement:

```ts
export async function loadPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  installPdfjsPolyfills()
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  return pdfjsLib
}

export async function loadPdfjsWorkerLib(): Promise<typeof import('pdfjs-dist')> {
  installPdfjsPolyfills()
  const pdfjsLib = await import('pdfjs-dist')
  const { WorkerMessageHandler } = await import('pdfjs-dist/build/pdf.worker.mjs')
  Object.assign(globalThis, { pdfjsWorker: { WorkerMessageHandler } })
  return pdfjsLib
}
```

Do not create a nested Worker or globally monkey-patch `console.warn`.

- [ ] **Step 6: Route thumbnail rendering through the explicit worker loader**

Import `loadPdfjsWorkerLib`, then use:

```ts
const pdfjs = await loadPdfjsWorkerLib()
const pdf = await pdfjs.getDocument({
  data: await file.arrayBuffer(),
  CanvasFactory: OffscreenCanvasFactory,
  FilterFactory: WorkerFilterFactory,
  disableFontFace: true,
  useSystemFonts: false,
  verbosity: pdfjs.VerbosityLevel.ERRORS
}).promise
```

This suppresses expected background local-handler/font warnings only for thumbnail work; leave real
worker/job errors untouched.

- [ ] **Step 7: Run PDF loader/worker and build-contract tests**

Run:

```bash
npx vitest run \
  src/renderer/src/lib/__tests__/pdfjs-loader.test.ts \
  src/renderer/src/workers/__tests__/thumbnail-render.worker.test.ts \
  src/main/__tests__/electron-vite-config.test.ts \
  src/main/__tests__/check-packaged-runtime.test.ts
npm run typecheck
npm run build
```

Expected: all tests, typecheck, and build pass; the emitted PDF worker remains compiled and present.

- [ ] **Step 8: Commit PDF execution-boundary changes**

```bash
git add \
  src/renderer/src/lib/pdfjs-loader.ts \
  src/renderer/src/lib/__tests__/pdfjs-loader.test.ts \
  src/renderer/src/workers/thumbnail-render.worker.ts \
  src/renderer/src/workers/__tests__/thumbnail-render.worker.test.ts
git commit -m "fix: separate PDF renderer and background workers"
```

---

### Task 6: Make PDF page navigation pure and rapid-command safe

**Files:**

- Modify:
  `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/PdfPreview.tsx`
- Modify:
  `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/PdfPreview.test.tsx`
- Inspect without planned production changes:
  `src/renderer/src/components/Projection/FileProjection.tsx`
- Modify:
  `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`

**Interfaces:**

- Consumes: Presenter `sendCommand({ action: 'pdfPage', value })` and existing projection page
  identity/render fencing.
- Produces: pure local state updates, exact ordered page commands, no cross-component render-phase
  update, and cached-preview continuity.

- [ ] **Step 1: Expose the existing command mock and add a failing render-phase test**

Hoist `mockSendCommand` instead of returning an anonymous `vi.fn()` from the Presenter context mock,
and import `useState` from React. Add a small parent harness whose state setter is invoked by
`mockSendCommand`, then spy on the React warning:

```tsx
it('does not update projection state from inside the page state updater', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  let updateParent: (() => void) | undefined
  function Harness(): React.JSX.Element {
    const [, setRevision] = useState(0)
    updateParent = () => setRevision((value) => value + 1)
    return <PdfPreview item={makeItem()} />
  }
  mockSendCommand.mockImplementation(() => updateParent?.())
  render(<Harness />)
  await waitFor(() => expect(getPageMock).toHaveBeenCalled())

  act(() => window.dispatchEvent(new CustomEvent('media:pdfNextPage')))

  expect(consoleError).not.toHaveBeenCalledWith(
    expect.stringContaining('Cannot update a component')
  )
  consoleError.mockRestore()
})
```

Use `try/finally` to restore the spy if the local test style requires it.

- [ ] **Step 2: Run the render-phase test and verify RED**

Run:

```bash
npx vitest run \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/PdfPreview.test.tsx \
  -t "inside the page state updater"
```

Expected: FAIL because `sendCommand()` currently executes inside the functional state updater.

- [ ] **Step 3: Add a failing rapid-navigation test**

```ts
it('sends the latest page for rapid next commands', async () => {
  render(<PdfPreview item={makeItem()} />)
  await waitFor(() => expect(getPageMock).toHaveBeenCalled())
  mockSendCommand.mockClear()

  act(() => {
    window.dispatchEvent(new CustomEvent('media:pdfNextPage'))
    window.dispatchEvent(new CustomEvent('media:pdfNextPage'))
  })

  expect(mockSendCommand).toHaveBeenNthCalledWith(1, { action: 'pdfPage', value: 2 })
  expect(mockSendCommand).toHaveBeenNthCalledWith(2, { action: 'pdfPage', value: 3 })
})
```

- [ ] **Step 4: Run the rapid-navigation test and verify RED if batching exposes stale state**

Run:

```bash
npx vitest run \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/PdfPreview.test.tsx \
  -t "rapid next commands"
```

Expected: either FAIL with repeated page 2/stale state, or pass while the render-phase regression
remains RED. Record the observed result; do not weaken the test.

- [ ] **Step 5: Implement one item-scoped page command helper**

Add:

```ts
const currentPageRef = useRef(1)

const selectPage = useCallback(
  (requestedPage: number): void => {
    const nextPage = Math.min(pageCount, Math.max(1, requestedPage))
    if (nextPage === currentPageRef.current) return
    currentPageRef.current = nextPage
    setCurrentPage(nextPage)
    sendCommand({ action: 'pdfPage', value: nextPage })
  },
  [pageCount, sendCommand]
)
```

When a PDF loads, set both `currentPageRef.current = 1` and `setCurrentPage(1)`. Replace next/previous
functional updaters and thumbnail page selection with `selectPage(...)`. Event handlers use
`currentPageRef.current ± 1`.

Keep scroll commands, view-mode commands, render cancellation, and thumbnail behavior unchanged.

- [ ] **Step 6: Add a projection cached-preview page continuity characterization**

Use the existing `mockPdf(2, true)` helper and cached thumbnails:

```ts
it('keeps the requested cached PDF page until its full render completes', async () => {
  const { renderResolves } = mockPdf(2, true)
  mockGetPdfPageThumbs.mockResolvedValue(['blob:page-1', 'blob:page-2'])
  const { container, rerender } = render(
    <FileProjection
      fileName="slides.pdf"
      initialItemId="pdf-id"
      initialBlobId="pdf-blob"
      initialMimeType="application/pdf"
    />
  )
  await waitFor(() => expect(renderResolves.has(1)).toBe(true))

  rerender(
    <FileProjection
      fileName="slides.pdf"
      initialItemId="pdf-id"
      initialBlobId="pdf-blob"
      initialMimeType="application/pdf"
      controlEvent={{ id: 1, data: { action: 'pdfPage', value: 2 } }}
    />
  )
  await waitFor(() => expect(renderResolves.has(2)).toBe(true))
  expect(container.querySelector('[data-pdf-preview="2"]')).not.toBeNull()
  expect(container.querySelector('canvas[data-pdf-page="2"]')).toBeNull()

  await act(async () => renderResolves.get(2)?.())
  await waitFor(() => {
    expect(container.querySelector('canvas[data-pdf-page="2"]')).not.toBeNull()
  })
  expect(container.querySelector('[data-pdf-preview="2"]')).toBeNull()
})
```

This should pass against the existing projection page/window fencing. If it does not, stop Task 6
and return to root-cause investigation before changing `FileProjection.tsx`; do not patch around a
different observed failure.

- [ ] **Step 7: Run PDF preview/projection suites and verify GREEN**

Run:

```bash
npx vitest run \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/PdfPreview.test.tsx \
  src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
npm run typecheck:web
```

Expected: all tests and web typecheck pass with no uncaught React warning.

- [ ] **Step 8: Commit pure PDF navigation**

```bash
git add \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/PdfPreview.tsx \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/PdfPreview.test.tsx \
  src/renderer/src/components/Projection/FileProjection.tsx \
  src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
git commit -m "fix: keep PDF page projection updates outside render"
```

Stage the projection files only if Task 6 changed them.

---

### Task 7: Run full automated verification

**Files:**

- No planned source modifications.
- Inspect: `package.json`, `playwright.electron.config.ts`, `e2e/electron-packaged.spec.ts`.

**Interfaces:**

- Consumes: Tasks 1-6.
- Produces: clean lint/typecheck/unit/build/unpacked/package E2E evidence without release or merge.

- [ ] **Step 1: Run formatting check and lint**

```bash
npx prettier --check \
  src/main/windowManager.ts \
  src/main/ipc/projection-vlc.ts \
  src/renderer/src/contexts/ProjectionContext.tsx \
  src/renderer/src/lib/media-projection-sync.ts \
  src/renderer/src/lib/pdfjs-loader.ts \
  src/renderer/src/workers/thumbnail-render.worker.ts \
  src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx \
  src/renderer/src/components/Control/FileExplorer/Presenter/Preview/PdfPreview.tsx
npm run lint
```

Expected: formatting check and ESLint pass with no warnings promoted to errors.

- [ ] **Step 2: Run both typechecks**

```bash
npm run typecheck
```

Expected: node and web TypeScript checks pass.

- [ ] **Step 3: Run all Vitest tests**

```bash
npm test
```

Expected: all test files pass; baseline before implementation was 251 files / 3,013 tests.

- [ ] **Step 4: Build and validate the unpacked desktop runtime**

```bash
npm run build
npm run build:unpack
```

Expected: typecheck, electron-vite build, bundle checks, native runtime checks, strict VLC runtime
preparation, unpacked packaging, and packaged-runtime validation all pass.

- [ ] **Step 5: Run packaged Electron E2E**

```bash
npm run test:e2e:packaged
```

Expected: healthy MP4/MKV, broken-cues, unreadable replacement/retry, projection recovery, and
existing packaged regressions pass. If the existing spec does not assert output-window options or
operator control state, keep those checks in unit plus real-device smoke rather than introducing a
CI-only fake second display.

- [ ] **Step 6: Inspect final diff and commit only authorized verification fixes**

```bash
git status --short
git diff --check
git diff origin/main...HEAD --stat
```

If verification required an in-scope correction, repeat its focused RED/GREEN cycle and commit it
with a conventional `fix:` message. Do not bundle unrelated cleanup.

---

### Task 8: Execute macOS development and packaged product smoke

**Files:**

- Read-only fixtures: `/Users/rayselfs/Desktop/test/*`
- Read-only committed fixtures: `e2e/fixtures/vlc/*`
- No source modification unless smoke reproduces an authorized regression; any correction returns to
  the relevant TDD task before retrying smoke.

**Interfaces:**

- Consumes: verified unpacked/packaged application and the approved fixture matrix.
- Produces: product-level evidence for focus, display fill, VLC transport, PDF worker/navigation, and
  recovery; no release action.

- [ ] **Step 1: Verify fixture identity**

```bash
shasum -a 256 \
  /Users/rayselfs/Desktop/test/ForBiggerBlazes.mkv \
  /Users/rayselfs/Desktop/test/sample_1280x720_surfing_with_audio.mkv \
  /Users/rayselfs/Desktop/test/ForBiggerBlazes.mp4 \
  /Users/rayselfs/Desktop/test/create-landing.mp4 \
  '/Users/rayselfs/Desktop/test/1718期-末世警鐘~在神面前存憂傷痛悔的心.pdf' \
  '/Users/rayselfs/Desktop/test/法人登記證書.pdf'
```

Expected hashes are the six values recorded in the spec. Stop smoke if any differs and report the
fixture drift.

- [ ] **Step 2: Run Electron development smoke on a real external display**

Start:

```bash
npm run dev
```

From the control window, import/use the Desktop/test folder, open projection on the external display,
and verify:

1. control retains keyboard focus after projection open;
2. mixed MP4/MKV replacement at least 20 times never changes projection bounds/display fill;
3. projection never enters or exits a macOS native fullscreen Space;
4. both MKVs accept immediate play without waiting;
5. the long MKV pauses/resumes and seeks near start, middle, and end with confirmed control state;
6. central play overlay disappears on confirmed playback and the timeline remains usable;
7. the 22-page PDF rapidly navigates forward/backward without React render-phase warning;
8. renderer/projection uses a real PDF worker; background thumbnail local-handler warnings do not
   pollute the control console;
9. TrueType diagnostics, if present, do not interrupt projection;
10. the single-page PDF stays bounded at page 1.

- [ ] **Step 3: Run packaged/unpacked macOS smoke with the same matrix**

Launch the application produced by `npm run build:unpack` from its explicit output path discovered by:

```bash
find dist -maxdepth 3 -type d -name 'HHC Presenter.app' -print
```

Repeat the Task 8 Step 2 checks. Additionally replace a healthy MKV with
`e2e/fixtures/vlc/unreadable-truncated.mkv`, confirm typed error/retry, then play a healthy item
without restarting the app.

- [ ] **Step 4: Record final gate status without expanding authority**

Report separately:

- source and automated-test status;
- Electron dev external-display smoke;
- unpacked/packaged macOS smoke;
- any unverified Windows physical-device gate;
- branch/commit state;
- explicit exclusions: merge, tag, release, updater publication, deployment.

Do not mark production-ready if either real-display smoke is incomplete or a reproduced operator
workflow fails.
