# Projection Playback Lifecycle Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make macOS external projection use non-always-on-top simple fullscreen and make desktop-engine MKV playback expose only authoritative VLC state with bounded cold-cache startup.

**Architecture:** Keep the existing `WindowManager`, one owned main-process VLC session, projection message channel, Zustand media store, and fingerprinted derivative cache. Establish macOS simple fullscreen once before content replay, publish explicit VLC phases through `file:playback-state`, prevent the Control renderer from starting its own MKV playback, and replace derivative full decode with an error-strict packet-copy scan.

**Tech Stack:** Electron 41, React 19, TypeScript, Zustand, Vitest, Testing Library, libVLC through `electron-vlc-player`, bundled FFmpeg.

**Spec:** `docs/superpowers/specs/2026-08-31-projection-product-flow-design.md`

## Global Constraints

- The control window remains the only operator surface.
- No `alwaysOnTop`, `screen-saver` window level, native fullscreen Space, `moveTop()`, or content-triggered fullscreen.
- Do not replace VLC, FFmpeg, Electron, PDF.js, or `electron-vlc-player`.
- Do not mutate imported sources or add a second player, worker, persistent job system, or projection manager abstraction.
- Preserve generation, attempt, item, and lifecycle ownership fences plus typed VLC failures.
- Warm-cache first advancing state must arrive within one second; the 36 MB cold-cache fixture must arrive within three seconds on the current test Mac.
- Use `/Users/rayselfs/Desktop/test` read-only and remove only task-created derivative cache entries during cold-cache acceptance.
- Do not push, merge, tag, release, or deploy.

---

### Task 1: macOS simple-fullscreen projection lifecycle

**Files:**

- Modify: `src/main/__tests__/windowManager.test.ts`
- Modify: `src/main/windowManager.ts`

**Interfaces:**

- Consumes: existing `WindowManager.createProjectionWindow(displayId?: string): BrowserWindow` and retained `mainWindow` reference.
- Produces: one initial macOS external-display `setSimpleFullScreen(true)` transition followed by `setFocusable(false)` and control-window focus restoration.

- [ ] **Step 1: Write the failing macOS window test**

Add `setSimpleFullScreen`, `isSimpleFullScreen`, and `setFocusable` spies to `FakeBrowserWindow`. Replace the always-on-top assertion with:

```ts
it('enters simple fullscreen once without keeping external projection always-on-top', () => {
  const wm = WindowManager.getInstance()
  wm.createMainWindow()
  const control = FakeBrowserWindow.instances[0]
  wm.createProjectionWindow('2')
  const projection = FakeBrowserWindow.instances[1]

  projection.emitOnce('ready-to-show')

  expect(projection.showInactive).toHaveBeenCalledOnce()
  expect(projection.setAlwaysOnTop).not.toHaveBeenCalled()
  expect(projection.setFullScreen).not.toHaveBeenCalled()
  if (process.platform === 'darwin') {
    expect(projection.setSimpleFullScreen).toHaveBeenCalledWith(true)
    expect(projection.setFocusable).toHaveBeenCalledWith(false)
    expect(control.focus).toHaveBeenCalledOnce()
  }
})
```

Update the external BrowserWindow option assertion so macOS starts focusable for the one transition and non-macOS stays non-focusable:

```ts
focusable: process.platform === 'darwin',
fullscreenable: false
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: FAIL because `setAlwaysOnTop(true, 'screen-saver')` is still called and `setSimpleFullScreen(true)`/`setFocusable(false)` are absent.

- [ ] **Step 3: Implement the minimal window transition**

In `createProjectionWindow`, calculate:

```ts
const useMacSimpleFullscreen = process.platform === 'darwin' && hasSecondScreen
```

Use `focusable: useMacSimpleFullscreen` at construction. Delete the external `setAlwaysOnTop` call. In `ready-to-show`, keep `showInactive()`, then:

```ts
if (useMacSimpleFullscreen) {
  projectionWindow.setSimpleFullScreen(true)
  projectionWindow.setFocusable(false)
  if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.focus()
}
```

Do not add fallback z-order behavior. Content changes, replacement, recovery, and replay continue to reuse the same creation path.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: PASS with no always-on-top or native-fullscreen calls.

- [ ] **Step 5: Commit the window lifecycle change**

```bash
git add src/main/windowManager.ts src/main/__tests__/windowManager.test.ts
git commit -m "fix: use simple fullscreen for mac projection"
```

---

### Task 2: Authoritative VLC playback phases

**Files:**

- Modify: `src/shared/projection-messages.ts`
- Modify: `src/main/ipc/validate.ts`
- Modify: `src/main/__tests__/ipc/validate.test.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx`
- Modify: `src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx`
- Modify: `src/renderer/src/lib/presentability.ts`

**Interfaces:**

- Produces: `export type FilePlaybackPhase = 'preparing' | 'ready' | 'playing' | 'paused' | 'ended'`.
- Produces: required `phase: FilePlaybackPhase` on `ProjectionMessageMap['file:playback-state']`.
- Consumes: existing `WindowManager.sendToMain('projection:message', generation, 'file:playback-state', payload)`.
- Produces: `MediaTypeStateMap['video'].phase?: FilePlaybackPhase` for Control rendering.

- [ ] **Step 1: Write failing shared validation and VLC phase tests**

Add a validation case requiring one of the exact phases:

```ts
expect(() =>
  validateProjectionMessageTuple([
    'file:playback-state',
    {
      itemId: 'item-1',
      phase: 'buffering',
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isEnded: false
    }
  ])
).toThrow('Invalid projection message')
```

Add a VLC test with deferred path resolution that asserts `preparing` is published before a player exists and a queued play survives:

```ts
it('publishes preparing and retains play until owner-confirmed playing', async () => {
  const playbackPath = deferred<string>()
  mockResolveVideoPlaybackPath.mockReturnValueOnce(playbackPath.promise)
  const startPromise = getHandler('projection-vlc:start')(makeEvent(), {
    itemId: 'item-1',
    attemptId: 'attempt-1',
    sourceFileId: '550e8400-e29b-41d4-a716-446655440000',
    container: '#vlc-player'
  })

  await vi.waitFor(() =>
    expect(mockWindowManager.sendToMain).toHaveBeenCalledWith(
      'projection:message',
      4,
      'file:playback-state',
      expect.objectContaining({ itemId: 'item-1', phase: 'preparing', isPlaying: false })
    )
  )
  getHandler('projection-vlc:control')(makeEvent(), { action: 'play', itemId: 'item-1' })
  playbackPath.resolve('/native-files/prepared.mkv')
  await startPromise
  mockVlcPlayers[0].emit('playing')

  expect(mockWindowManager.sendToMain).toHaveBeenLastCalledWith(
    'projection:message',
    4,
    'file:playback-state',
    expect.objectContaining({ phase: 'playing', isPlaying: true })
  )
})
```

Update the existing started-acknowledgement test to assert no `projection-vlc:started` before `playing`/`paused`, then assert it after startup finalization.

- [ ] **Step 2: Run focused phase tests and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/ipc/validate.test.ts src/main/__tests__/ipc/projection-vlc.test.ts
```

Expected: FAIL because phase is absent, preparing is not published, and started acknowledgement is premature.

- [ ] **Step 3: Add the typed phase contract**

In `src/shared/projection-messages.ts`:

```ts
export type FilePlaybackPhase = 'preparing' | 'ready' | 'playing' | 'paused' | 'ended'
```

Add `phase: FilePlaybackPhase` to `file:playback-state`. Validate the exact union in `validateProjectionMessageTuple`. Add `phase?: FilePlaybackPhase` to the Zustand video state type because no state exists before the first message.

Update the native HTML video sender in `FileProjection`:

```ts
phase: (next?.isEnded ?? video.ended)
  ? 'ended'
  : (next?.isPlaying ?? !video.paused)
    ? 'playing'
    : video.currentTime > 0
      ? 'paused'
      : 'ready'
```

- [ ] **Step 4: Publish VLC preparing and confirmed phases**

Add `confirmedPlaybackStarted: boolean` to `OwnedVlcSession`, initialized from an initial positive position, `playing`, or `ended` replay state.

Before awaiting `resolveVideoPlaybackPath`, publish:

```ts
wm.sendToMain('projection:message', session.generation, 'file:playback-state', {
  itemId: session.itemId,
  phase: 'preparing',
  currentTime: request.initialPositionSeconds ?? 0,
  duration: request.durationMs ? request.durationMs / 1000 : 0,
  isPlaying: false,
  isEnded: false,
  ...(request.initialVolume !== undefined ? { volume: request.initialVolume } : {})
})
```

In `sendState`, derive the confirmed phase only from native state:

```ts
const phase = isEnded
  ? 'ended'
  : isPlaying
    ? 'playing'
    : session.confirmedPlaybackStarted
      ? 'paused'
      : 'ready'
```

Set `confirmedPlaybackStarted = true` on owner-matched `playing`. Move `publishStarted(wm, session)` from the end of `startVlc` into `finishStartup` after authoritative state publication. Keep the watchdog and failure path unchanged.

- [ ] **Step 5: Propagate phase into Control state**

Copy `data.phase` in `MediaProjectionBridge` and any duplicate `ProjectionContext` playback reducer into `typeStates.video`. Update component tests so `preparing`, `ready`, `playing`, `paused`, and `ended` preserve item fencing and monotonic `hasStarted`.

- [ ] **Step 6: Run focused phase tests and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/ipc/validate.test.ts src/main/__tests__/ipc/projection-vlc.test.ts src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
```

Expected: PASS; `preparing` occurs before player creation and `playing` only after the native event.

- [ ] **Step 7: Commit the phase contract**

```bash
git add src/shared/projection-messages.ts src/main/ipc/validate.ts src/main/__tests__/ipc/validate.test.ts src/main/ipc/projection-vlc.ts src/main/__tests__/ipc/projection-vlc.test.ts src/renderer/src/components/Projection/FileProjection.tsx src/renderer/src/contexts/ProjectionContext.tsx src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/lib/presentability.ts
git commit -m "fix: expose authoritative VLC playback phases"
```

---

### Task 3: Control stops locally playing desktop-engine MKV

**Files:**

- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`

**Interfaces:**

- Consumes: snapshot entry `playbackMode === 'vlc-embedded'` and `typeStates.video.phase` from Task 2.
- Produces: Control commands that do not call Chromium `play()`, `pause()`, or set `currentTime` for VLC-owned items.
- Produces translation key `presenter.videoPreparing`.

- [ ] **Step 1: Write failing desktop-engine Control tests**

Extend the test snapshot entry type with `playbackMode?: 'native' | 'vlc-embedded'` and add a helper that marks the current item `vlc-embedded`.

Add:

```ts
it('sends play without starting Chromium for a VLC-owned item', async () => {
  setVlcPlaybackMode()
  storeState.typeStates.video = {
    phase: 'ready',
    hasStarted: false,
    isPlaying: false,
    isEnded: false,
    currentTime: 0,
    duration: 81,
    seekable: true
  }
  const { container } = render(<VideoPreview item={makeCopy('video/x-matroska', 'movie.mkv')} />)
  const video = await getLoadedVideo(container)

  fireEvent.click(container.querySelector('button.absolute.inset-0.flex')!)

  expect(video.play).not.toHaveBeenCalled()
  expect(mockSendCommand).toHaveBeenCalledWith({ action: 'play', itemId: 'copy-id' })
})
```

Add a preparing-state test:

```ts
it('shows preparation without claiming playback for a VLC-owned item', async () => {
  setVlcPlaybackMode()
  storeState.typeStates.video = {
    phase: 'preparing',
    hasStarted: false,
    isPlaying: false,
    isEnded: false,
    currentTime: 0,
    duration: 81
  }
  render(<VideoPreview item={makeCopy('video/x-matroska', 'movie.mkv')} />)

  expect(screen.getByRole('status')).toHaveTextContent('presenter.videoPreparing')
  expect(screen.queryByLabelText('Toggle play')).toBeNull()
})
```

- [ ] **Step 2: Run the focused Control test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx
```

Expected: FAIL because VLC ownership is ignored, Chromium `play()` is called, and no preparing status exists.

- [ ] **Step 3: Implement VLC-owned command-only controls**

Resolve once per render:

```ts
const usesProjectionVlc = useMediaProjectionStore((state) =>
  state.snapshot?.entries.some(
    (entry) => entry.itemId === item.id && entry.playbackMode === 'vlc-embedded'
  )
)
const isPreparing = usesProjectionVlc && projectionPlaybackState?.phase === 'preparing'
```

In play, pause, replay, and seek handlers, skip local media element mutations when `usesProjectionVlc`; send the existing command only. Preserve current local behavior for native MP4/audio and browser mode.

Render a pointer-safe status over the preview while preparing:

```tsx
{
  isPreparing && (
    <div
      role="status"
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 text-white"
    >
      {t('presenter.videoPreparing')}
    </div>
  )
}
```

Do not render the optimistic central toggle while preparing. Once phase is `ready`, show the play button; once `playing`, use only confirmed state.

Add translations:

```json
"videoPreparing": "Preparing video..."
```

```json
"videoPreparing": "影片準備中…"
```

```json
"videoPreparing": "视频准备中…"
```

- [ ] **Step 4: Run the focused Control test and verify GREEN**

Run:

```bash
npx vitest run src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx
```

Expected: PASS; VLC-owned controls never call the local media playback methods.

- [ ] **Step 5: Commit the Control authority change**

```bash
git add src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
git commit -m "fix: keep VLC controls projection-authoritative"
```

---

### Task 4: Fast Matroska derivative packet validation

**Files:**

- Modify: `src/main/__tests__/ipc/video-remux.test.ts`
- Modify: `src/main/ipc/video-remux.ts`

**Interfaces:**

- Consumes: existing `runFfmpegProcess` and atomic derivative paths.
- Produces: second FFmpeg validation invocation with `-c copy -f null -`, retaining `-v error -xerror`.

- [ ] **Step 1: Write the failing exact FFmpeg contract test**

Update the second invocation assertion to require packet copy:

```ts
expect(mockRunFfmpeg).toHaveBeenNthCalledWith(2, {
  executable: '/runtime/ffmpeg',
  args: [
    '-hide_banner',
    '-nostdin',
    '-v',
    'error',
    '-xerror',
    '-i',
    expect.stringMatching(/\.tmp\.mkv$/),
    '-map',
    '0',
    '-c',
    'copy',
    '-f',
    'null',
    '-'
  ],
  timeoutMs: expect.any(Number),
  signal: expect.any(AbortSignal)
})
```

Keep the existing validation-failure cleanup test unchanged so unreadable derivatives remain rejected.

- [ ] **Step 2: Run the remux test and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/ipc/video-remux.test.ts
```

Expected: FAIL because the validation pass decodes rather than packet-copies.

- [ ] **Step 3: Add packet copy to validation**

Insert only:

```ts
'-c',
'copy',
```

between `'-map', '0'` and `'-f', 'null'` in the second FFmpeg invocation. Preserve timeout, abort, `-xerror`, atomic rename, sidecar, source revalidation, and cleanup behavior.

- [ ] **Step 4: Run the remux test and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/ipc/video-remux.test.ts
```

Expected: PASS, including truncated-payload rejection and cache/source preservation tests.

- [ ] **Step 5: Commit the remux latency change**

```bash
git add src/main/ipc/video-remux.ts src/main/__tests__/ipc/video-remux.test.ts
git commit -m "perf: validate MKV derivatives without decoding"
```

---

### Task 5: Full verification and real external-display acceptance

**Files:**

- Modify only if verification exposes a failing requirement already covered by Tasks 1-4.

**Interfaces:**

- Consumes: all prior task outputs.
- Produces: automated, development, packaged, focus, fullscreen, latency, seek, replacement, PDF, and failure evidence.

- [ ] **Step 1: Run formatting and static verification**

```bash
npx prettier --check docs/superpowers/specs/2026-08-31-projection-product-flow-design.md docs/superpowers/plans/2026-08-31-projection-playback-lifecycle-follow-up.md src/main/windowManager.ts src/main/__tests__/windowManager.test.ts src/shared/projection-messages.ts src/main/ipc/validate.ts src/main/ipc/projection-vlc.ts src/main/ipc/video-remux.ts src/renderer/src/components/Projection/FileProjection.tsx src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx
npm run lint
npm run typecheck
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Run all automated tests and builds**

```bash
npm test
npm run build
npm run build:unpack
PACKAGED_APP_PATH="$PWD/dist/mac-arm64/HHC Presenter.app/Contents/MacOS/HHC Presenter" npm run test:e2e:packaged
```

Expected: all tests, bundle budgets, packaged runtime checks, healthy/broken/unreadable VLC fixtures, and retry/cache checks pass.

- [ ] **Step 3: Measure FFmpeg cold preparation outside the app**

Use a task-specific temporary directory. Run the exact stream-copy remux plus packet-copy validation against `/Users/rayselfs/Desktop/test/sample_1280x720_surfing_with_audio.mkv`. Record total wall time; expected under three seconds on this Mac. Trash the temporary directory afterward.

- [ ] **Step 4: Run development external-display smoke**

Start `npm run dev` from this worktree. With the DELL P2423 connected:

1. Confirm Projection fills only the DELL using simple fullscreen.
2. Activate another application and confirm Projection does not remain above it.
3. Return to Control and confirm keyboard focus remains on its HTML content.
4. Remove only the two task-created dev derivative cache entries corresponding to the imported Desktop fixtures.
5. Start `ForBiggerBlazes.mkv` and `sample_1280x720_surfing_with_audio.mkv` once cold and once warm.
6. Confirm one click is retained through preparing, Control never claims playing early, warm first advancing state is at most one second, and cold first advancing state is at most three seconds.
7. Pause/resume and seek near start, middle, and end; Control and Projection time agree.
8. Replace MP4/MKV at least 20 times; Projection remains simple fullscreen and Control keeps focus.
9. Rapidly navigate the 22-page PDF and the single-page PDF; no fake-worker or render crash appears.

- [ ] **Step 5: Run rebuilt unpacked-app smoke**

Launch exactly `dist/mac-arm64/HHC Presenter.app`, not an installed or older bundle. Repeat fullscreen/z-order, cold/warm MKV, seek, replacement, PDF, and unreadable recovery checks. Quit the app and confirm no Presenter process remains.

- [ ] **Step 6: Clean task-generated artifacts and confirm branch state**

Move only task-generated `playwright-report/` and `test-results/` to Trash. Remove task-created runtime symlinks only after the final smoke no longer needs them. Run:

```bash
git status --short
git log --oneline --decorate -8
```

Expected: clean `fix/projection-product-flow`; no push, merge, tag, release, or deployment.
