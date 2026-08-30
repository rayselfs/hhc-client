# VLC Projection Production Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HHC Presenter VLC projection production-reliable across startup, confirmed controls, rapid replacement, remote/local Matroska, recoverable container damage, and clean failure without blocking the app or mutating sources.

**Architecture:** Keep the existing single main-process VLC player and add one explicit owned-session contract around it. Use VLC events as confirmed state, remove synchronous probing, and resolve fingerprinted on-demand Matroska derivatives inside that owned main-process startup. Reuse current readiness tokens, sync supersession, native-file authorization, projection recovery, cleanup journal, and packaged-runtime workflows; add no second player, renderer retry loop, worker pool, or durable remux job system.

**Tech Stack:** Electron 41, TypeScript, React 19, Vitest, Playwright, electron-vlc-player 1.0.2, bundled FFmpeg

**Spec:** `docs/superpowers/specs/2026-08-29-vlc-projection-reliability-design.md`

## Global Constraints

- Preserve Electron/browser dual-mode behavior; remux is Electron-only.
- Preserve every imported source byte-for-byte and verify source SHA-256 in packaged tests.
- Use dynamic `app.getPath('userData')`; never hard-code HHC Presenter or LibrePresenter profile paths.
- Treat `projection-vlc:started` only as native surface/source installation, never decoded playback.
- Treat VLC owner-matched `file:playback-state` as the only confirmed embedded-VLC state.
- Do not infer seekability from extension, duration, `setSource()`, or successful `setTime()`.
- Do not classify VideoToolbox decoder-selection messages as failures.
- Cache reuse requires a current source SHA-256 fingerprint and non-empty derivative.
- Poster timeout remains 15 seconds; remux hard timeout is 30 minutes.
- One 15-second VLC watchdog covers source installation through seek and final transport
  confirmation; clear it only after final confirmation or session invalidation.
- Remux requires at least `ceil(sourceSize * 1.2) + 256 MiB` available.
- Stale remux temp files older than 24 hours are removed at startup.
- Follow RED-GREEN-REFACTOR for every task. Do not merge, tag, release, publish updater metadata, or deploy without an explicit later gate.

---

### Task 0: Create the isolated execution baseline

**Files:**

- Add to implementation branch: `docs/superpowers/specs/2026-08-29-vlc-projection-reliability-design.md`
- Add to implementation branch: `docs/superpowers/plans/2026-08-29-vlc-projection-reliability.md`
- No production source changes

**Interfaces:**

- Consumes: reviewed spec and plan from the primary checkout.
- Produces: isolated `fix/vlc-production-reliability` worktree based on latest `origin/main` with the two reviewed documents committed first.

- [ ] Use `superpowers:using-git-worktrees` before any source/test edit. Fetch `origin`, create branch
      `fix/vlc-production-reliability` from `origin/main`, and verify the worktree is clean.
- [ ] Copy only the reviewed VLC spec/plan into that worktree, run `git diff --check`, and commit:

  ```bash
  git add docs/superpowers/specs/2026-08-29-vlc-projection-reliability-design.md \
    docs/superpowers/plans/2026-08-29-vlc-projection-reliability.md
  git commit -m "docs: define VLC production reliability"
  ```

- [ ] Record `git rev-parse HEAD`, installed `electron-vlc-player` version, VLC runtime info, FFmpeg
      runtime info, and current package scripts in the PR evidence draft.
- [ ] Run the untouched baseline suites:

  ```bash
  npx vitest run src/main/__tests__/ipc/projection-vlc.test.ts \
    src/renderer/src/lib/__tests__/presentation-readiness.test.ts \
    src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts
  ```

- [ ] Stop if the baseline fails for an unrelated reason; do not hide baseline failures inside the
      reliability implementation.

### Task 1: Establish one owner-safe VLC session and lossless startup controls

**Files:**

- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`
- Modify: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`

**Interfaces:**

- Consumes: current `ProjectionVlcStartRequest`, `ProjectionVlcControlRequest`, lifecycle generation,
  and one `VlcPlayer`.
- Produces module-local state equivalent to:

  ```ts
  interface PendingVlcControls {
    volume?: number
    seekSeconds?: number
    transport?: 'play' | 'pause'
  }

  interface OwnedVlcSession {
    itemId: string
    attemptId: string
    generation: number
    lifecycleVersion: number
    player: VlcPlayer | null
    sourceInstalled: boolean
    mediaReady: boolean
    seekable: boolean | null
    pending: PendingVlcControls
  }
  ```

- [ ] Add failing tests for controls arriving during runtime lookup and deferred `embed()`. Prove the
      latest volume, seek, and final transport command are retained independently.
- [ ] Add failing precedence tests: queued pause overrides `initialPlaybackState: 'playing'`, queued
      seek overrides `initialPositionSeconds`, and a different `itemId` cannot mutate the session.
- [ ] Add a failing media-readiness test where `setSource()` completes but `isSeekable()` remains
      false until an owner-matched VLC event. Assert volume may apply, but seek/transport do not flush
      at source installation.
- [ ] Add failing bootstrap/watchdog tests. After source installation the native child stays hidden
      and one internal `play()` starts decoding; the first owner-matched `playing` event applies
      seek/final transport but is not published as user-confirmed playback. Seek waits for an
      owner-matched time event, pause waits for `paused`, and the child is revealed only after final
      confirmation. If finalization does not complete within 15 seconds, the session fails and tears
      down without leaving a pending player.
- [ ] Add stale-owner tests where a destroyed old player emits `playing`, `stopped`, `endReached`,
      and `error` after a replacement player becomes active. Assert no state/failure is published for
      the replacement item.
- [ ] Add a delayed-stop race test: cleanup for attempt A aborts/waits while attempt B for the same
      item starts. A's eventual completion cannot clear, hide, or destroy B. Owner-scoped stop accepts
      `{ itemId, attemptId }`; projection close/blackout retains an explicit force-stop path.
- [ ] Run:

  ```bash
  npx vitest run src/main/__tests__/ipc/projection-vlc.test.ts \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
  ```

  Expected RED: controls are dropped while `player` is null, startup seek executes immediately after
  `setSource()`, and old-player events read module-global ownership.

- [ ] Replace parallel module globals with one owned-session record created before runtime discovery.
      Every event handler captures and verifies `{ player, itemId, generation, lifecycleVersion }`
      before native reads or publication.
- [ ] Coalesce startup controls. Apply volume after source installation, hide the native child, and
      issue one bootstrap `play()`. On the first owner-matched `playing`, apply seek only when
      `isSeekable() === true`; suppress bootstrap publication, wait for seek/final transport
      confirmation, then reveal the child and clear the watchdog.
- [ ] Invalidate the session before destroy on replacement, stop, projection close, runtime failure,
      and startup failure. Scope renderer effect cleanup to its attempt ID. Preserve premature-end
      detection and zero-position replay behavior.
- [ ] Re-run the focused suite and expect GREEN; commit:

  ```bash
  git add src/shared/ipc-channels.ts src/preload/index.ts src/preload/index.d.ts \
    src/main/ipc/projection-vlc.ts \
    src/renderer/src/components/Projection/FileProjection.tsx \
    src/main/__tests__/ipc/projection-vlc.test.ts \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
  git commit -m "fix: own VLC startup and controls"
  ```

### Task 2: Make VLC capability and playback events authoritative end-to-end

**Files:**

- Modify: `src/shared/projection-messages.ts`
- Modify: `src/main/ipc/validate.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/renderer/src/lib/presentability.ts`
- Modify: `src/renderer/src/lib/projection-session-coordinator.ts`
- Modify: `src/renderer/src/lib/projection-render-state.ts`
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/pages/ProjectionPage.tsx`
- Modify: `src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx`
- Modify: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`
- Modify: `src/main/__tests__/ipc/validate.test.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`
- Modify: `src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts`
- Modify: `src/renderer/src/lib/__tests__/projection-render-state.test.ts`
- Modify: `src/renderer/src/pages/__tests__/ProjectionPage.test.tsx`
- Modify: `src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx`

**Interfaces:**

- Produces:

  ```ts
  type FilePlaybackState = {
    itemId: string
    currentTime: number
    duration: number
    isPlaying: boolean
    isEnded: boolean
    playbackRate?: number
    seekable?: boolean
    volume?: number
  }
  ```

- `seekable` is optional for wire compatibility; embedded VLC treats missing as unknown/not seekable.

- [ ] Add validator RED tests accepting optional boolean `seekable` and finite `volume` in `[0, 1]`,
      while rejecting invalid values.
- [ ] Add VLC RED tests proving bootstrap events stay internal until finalization; afterward,
      owner-matched playing, paused, stopped, end, error, time, length, and buffering events publish
      current `isSeekable()`/volume and never publish for stale owners.
- [ ] Add coordinator/bridge RED tests proving commands do not confirm replay position, transport,
      volume, or end state; only `file:playback-state` updates durable replay and Zustand video state.
- [ ] Add recovery RED tests proving latest pending volume, seek, and transport are retained while
      opening/recovering and after send-but-before-confirmation. On ready, one `__system:replay`
      envelope contains the confirmed snapshot plus coalesced pending volume/seek/transport. The
      renderer atomically overlays all three onto local VLC initial start values without writing them
      into confirmed coordinator state. Add a same-tick replay test proving React batching cannot
      collapse the three values into the existing single control-event slot.
- [ ] Add acknowledgement RED tests: paused volume performs owner-safe `getVolume()` state
      publication without waiting for a VLC event; matching volume clears pending. Owner-confirmed
      `seekable: false` clears rejected pending seek/UI state without `setTime()` or later replay.
- [ ] Add preview RED tests proving `seekable !== true` disables pointer and keyboard-relative seek,
      prevents `setTime()`/seek IPC, and keeps requested position pending until confirmed VLC time.
- [ ] Run:

  ```bash
  npx vitest run src/main/__tests__/ipc/validate.test.ts \
    src/main/__tests__/ipc/projection-vlc.test.ts \
    src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts \
    src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx \
    src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx
  ```

  Expected RED: playback state lacks `seekable`, bridge state cannot store it, and command reducers
  optimistically confirm transport/seek.

- [ ] Extend the existing playback-state contract and bridge/store type; do not add a capability
      store. Change VLC state publication to accept the captured owned session rather than globals.
- [ ] Keep one coordinator-local pending requested-control record separate from the confirmed
      snapshot. Clear it on item replacement/end, serialize it atomically inside replay, and retain
      sent values until matching owner-confirmed playback state arrives so recovery cannot lose an
      in-flight command. Do not emit three back-to-back `file:control` messages from replay.
- [ ] Make the projection render reducer merge the replay envelope into local start values in one
      reducer action. This overlay is request state only and never feeds back into the coordinator's
      confirmed snapshot.
- [ ] Preserve transient drag/seek feedback, but update durable embedded-VLC position and transport
      only from playback state. Guard slider and `media:videoSeekRelative` at the control UI.
      `FileProjection` forwards owner-tagged embedded-VLC seeks to the main session without applying
      its native-video `seekableRef` gate; the owner session alone queues/rejects `setTime()` from
      confirmed `isSeekable()`.
- [ ] Re-run the focused suites and commit:

  ```bash
  git add src/shared/projection-messages.ts src/main/ipc/validate.ts \
    src/main/ipc/projection-vlc.ts src/renderer/src/lib/presentability.ts \
    src/renderer/src/lib/projection-session-coordinator.ts \
    src/renderer/src/lib/projection-render-state.ts \
    src/renderer/src/contexts/ProjectionContext.tsx \
    src/renderer/src/pages/ProjectionPage.tsx \
    src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx \
    src/renderer/src/components/Control/FileExplorer/Presenter/Preview/VideoPreview.tsx \
    src/main/__tests__/ipc/validate.test.ts src/main/__tests__/ipc/projection-vlc.test.ts \
    src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts \
    src/renderer/src/lib/__tests__/projection-render-state.test.ts \
    src/renderer/src/pages/__tests__/ProjectionPage.test.tsx \
    src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx \
    src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/CopiedMediaPreview.test.tsx
  git commit -m "fix: confirm VLC playback capabilities"
  ```

### Task 3: Remove synchronous libVLC probing from normal paths

**Files:**

- Modify: `src/renderer/src/lib/media-metadata.ts`
- Modify: `src/renderer/src/lib/presentation-readiness.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/renderer/src/lib/__tests__/media-metadata-authorization.test.ts`
- Modify: `src/renderer/src/lib/__tests__/presentation-readiness.test.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`

**Interfaces:**

- Removes: `projection-vlc:probe`, `projectionVlc.probe`, and native `probeMedia()` usage.
- Preserves: browser/native HTML-media metadata and runtime `projection-vlc:get-info`.

- [ ] Add RED tests proving desktop-engine readiness skips `ensureSourceMediaMetadata()` and native
      file metadata never invokes VLC probe. Assert desktop-engine readiness omits `seekable` instead
      of hard-coding `true`. Keep HTML-native MP4/MOV metadata behavior unchanged.
- [ ] Run:

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/media-metadata-authorization.test.ts \
    src/renderer/src/lib/__tests__/presentation-readiness.test.ts \
    src/main/__tests__/ipc/projection-vlc.test.ts
  ```

  Expected RED: desktop-engine video requests source metadata and the main handler exposes probe.

- [ ] Skip metadata only for `desktop-engine`, remove its readiness-time `seekable: true`, and let
      Task 2 playback state provide duration/capability. Remove channel, preload API/type, handler,
      validation, and helper without adding a replacement synchronous probe.
- [ ] Run `rg -n "projectionVlc\\.probe|projection-vlc:probe|probeVlcMedia|probeMedia" src` and
      confirm no normal runtime VLC probe remains.
- [ ] Re-run focused suites and commit:

  ```bash
  git add src/renderer/src/lib/media-metadata.ts \
    src/renderer/src/lib/presentation-readiness.ts src/shared/ipc-channels.ts \
    src/preload/index.ts src/preload/index.d.ts src/main/ipc/projection-vlc.ts \
    src/renderer/src/lib/__tests__/media-metadata-authorization.test.ts \
    src/renderer/src/lib/__tests__/presentation-readiness.test.ts \
    src/main/__tests__/ipc/projection-vlc.test.ts
  git commit -m "fix: remove blocking VLC media probe"
  ```

### Task 4: Extract an abortable FFmpeg process boundary

**Files:**

- Create: `src/main/ipc/ffmpeg-process.ts`
- Create: `src/main/__tests__/ipc/ffmpeg-process.test.ts`
- Modify: `src/main/ipc/video-poster.ts`
- Modify: `src/main/__tests__/ipc/video-poster.test.ts`
- Modify: `src/main/video-engine-runtime.ts`

**Interfaces:**

- Produces:

  ```ts
  interface RunFfmpegOptions {
    executable: string
    args: string[]
    timeoutMs: number
    signal?: AbortSignal
    maxOutputBytes?: number
  }

  function runFfmpegProcess(options: RunFfmpegOptions): Promise<{
    stdout: string
    stderr: string
  }>
  ```

- [ ] Add RED tests for `shell: false`, hidden Windows process, bounded stdout/stderr, spawn error,
      non-zero exit, timeout termination, AbortSignal termination, and waiting for child `close`
      before rejection.
- [ ] Add poster regression tests proving its current arguments and 15-second timeout remain intact.
- [ ] Run:

  ```bash
  npx vitest run src/main/__tests__/ipc/ffmpeg-process.test.ts \
    src/main/__tests__/ipc/video-poster.test.ts
  ```

  Expected RED: shared runner does not exist and poster owns fixed process behavior.

- [ ] Extract only process lifecycle behavior. Make the existing poster runtime resolver generic
      enough for poster and remux without adding a second resolver.
- [ ] Re-run tests and commit:

  ```bash
  git add src/main/ipc/ffmpeg-process.ts src/main/__tests__/ipc/ffmpeg-process.test.ts \
    src/main/ipc/video-poster.ts src/main/__tests__/ipc/video-poster.test.ts \
    src/main/video-engine-runtime.ts
  git commit -m "refactor: share FFmpeg process lifecycle"
  ```

### Task 5: Build a fingerprinted, cleanup-safe Matroska derivative manager

**Files:**

- Create: `src/main/ipc/video-remux.ts`
- Create: `src/main/__tests__/ipc/video-remux.test.ts`
- Modify: `src/main/ipc/native-fs.ts`
- Modify: `src/main/ipc/local-sync.ts`
- Modify: `src/main/ipc/onedrive-download.ts`
- Modify: `src/main/ipc/hhc-assets.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/__tests__/ipc/native-fs.test.ts`
- Modify: `src/main/__tests__/ipc/local-sync.test.ts`
- Modify: `src/main/__tests__/ipc/onedrive-download.test.ts`
- Modify: `src/main/__tests__/ipc/hhc-assets.test.ts`

**Interfaces:**

- Produces main-only functions:

  ```ts
  type VideoPlaybackVariant = 'source' | 'matroska-remux'

  function resolveVideoPlaybackPath(
    sourceFileId: string,
    variant: VideoPlaybackVariant
  ): Promise<string>
  function mutateVideoSource<T>(sourceFileId: string, mutation: () => Promise<T>): Promise<T>
  function cleanupStaleVideoRemuxTemps(now?: number): Promise<number>
  ```

- [ ] Add RED tests for UUID/native authorization, SHA-256 sidecar validation, non-empty cache reuse,
      same ID/new bytes invalidation, concurrent ensure dedupe, and a mismatched/missing sidecar.
- [ ] Add RED process tests for exact stream-copy arguments including `-nostdin`, `-map 0`,
      `-c copy`, `-f matroska`, and a `.mkv` temp suffix; remux timeout is 30 minutes.
- [ ] Add RED storage tests using
      `requiredBytes = Math.ceil(sourceSize * 1.2) + 256 * 1024 * 1024`; `requiredBytes - 1`
      fails and `requiredBytes` passes. Also cover non-zero/empty output, source identity changing
      before rename, and stale temp cleanup after 24 hours while younger temps remain.
- [ ] Add RED lifecycle tests for delete/atomic replacement during remux: invalidate generation,
      abort and wait for process close, remove derivative/sidecar/temp, and prove no later rename can
      recreate them.
- [ ] Add the specific gap test where invalidation has completed but the source rename is paused and
      a concurrent resolve starts. It must wait until the source mutation completes and must not
      publish a derivative for the old bytes.
- [ ] Run:

  ```bash
  npx vitest run src/main/__tests__/ipc/video-remux.test.ts \
    src/main/__tests__/ipc/native-fs.test.ts \
    src/main/__tests__/ipc/local-sync.test.ts \
    src/main/__tests__/ipc/onedrive-download.test.ts \
    src/main/__tests__/ipc/hhc-assets.test.ts
  ```

  Expected RED: remux manager/invalidation hooks do not exist.

- [ ] Implement one in-flight promise and generation per source. Compute source SHA-256 asynchronously,
      validate sidecar/output before reuse, revalidate generation and source identity before atomic
      rename, and keep every resolved path inside the main process.
- [ ] Serialize every ensure and source mutation per source ID. `mutateVideoSource()` invalidates the
      generation and aborts active work immediately, waits for child close, removes cache artifacts,
      runs the caller's delete/atomic rename, and prevents a new ensure from entering until mutation
      completes. Let errors propagate so existing cleanup/retry paths remain authoritative.
- [ ] Invoke stale-temp cleanup from main initialization as a caught background promise so window
      readiness never awaits it.
- [ ] Re-run focused tests and commit:

  ```bash
  git add src/main/ipc/video-remux.ts src/main/__tests__/ipc/video-remux.test.ts \
    src/main/ipc/native-fs.ts src/main/ipc/local-sync.ts \
    src/main/ipc/onedrive-download.ts src/main/ipc/hhc-assets.ts src/main/index.ts \
    src/main/__tests__/ipc/native-fs.test.ts src/main/__tests__/ipc/local-sync.test.ts \
    src/main/__tests__/ipc/onedrive-download.test.ts src/main/__tests__/ipc/hhc-assets.test.ts
  git commit -m "feat: cache safe Matroska derivatives"
  ```

### Task 6: Route local and remote Matroska through the derivative

**Files:**

- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/shared/projection-messages.ts`
- Modify: `src/main/ipc/validate.ts`
- Modify: `src/renderer/src/lib/presentation-readiness.ts`
- Modify: `src/renderer/src/lib/media-projection-payload.ts`
- Modify: `src/renderer/src/lib/media-projection-sync.ts`
- Modify: `src/renderer/src/lib/projection-render-state.ts`
- Modify: `src/renderer/src/pages/ProjectionPage.tsx`
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/components/Control/ProjectionRecoveryNotice.tsx`
- Modify: `src/renderer/src/lib/__tests__/presentation-readiness.test.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-payload.test.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-sync.test.ts`
- Modify: `src/renderer/src/lib/__tests__/projection-render-state.test.ts`
- Modify: `src/renderer/src/pages/__tests__/ProjectionPage.test.tsx`
- Modify: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`
- Modify: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`
- Modify: `src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx`
- Modify: `src/main/__tests__/ipc/validate.test.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`

**Interfaces:**

- Adds optional `playbackVariant?: 'source' | 'matroska-remux'` to readiness snapshot,
  `file:show`, and `ProjectionVlcStartRequest`; missing defaults to `source`.
- Stable VLC startup failures include `matroska-remux-failed`, `insufficient-storage`,
  `source-replaced`, `remux-timeout`, and `remux-cancelled`.

- [ ] Add validator RED tests accepting missing/known variants and rejecting unknown/non-string
      variants in both `file:show` and VLC start requests.
- [ ] Add readiness RED tests proving Electron Matroska snapshots the derivative variant without
      starting FFmpeg or delaying the rest of the playlist, while MP4 and browser files remain source
      playback.
- [ ] Add remote RED tests proving HHC remote-only Matroska downloads first, then commits the variant
      token, while project sequence/session revision/current item/access fences prevent a superseded
      result from projecting.
- [ ] Add main RED tests proving `projection-vlc:start` creates the owned session before awaiting
      derivative resolution, queues controls during remux, resolves `matroska-remux` only through the
      internal helper, and never falls back to the damaged source.
- [ ] Add failure/retry RED tests proving remux failure does not embed VLC or mark seekable, preserves
      the source, publishes the stable owner-matched recoverable failure, and the existing projection
      recovery retry starts a fresh owned attempt that can reuse or rebuild the cache. Prove a
      same-generation `__system:replay` increments a renderer-local VLC start revision and causes
      exactly one new `projectionVlc.start` call even when item/blob/replay values are unchanged.
- [ ] Run:

  ```bash
  npx vitest run src/main/__tests__/ipc/validate.test.ts \
    src/renderer/src/lib/__tests__/presentation-readiness.test.ts \
    src/renderer/src/lib/__tests__/media-projection-payload.test.ts \
    src/renderer/src/lib/__tests__/media-projection-sync.test.ts \
    src/renderer/src/lib/__tests__/projection-render-state.test.ts \
    src/renderer/src/pages/__tests__/ProjectionPage.test.tsx \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx \
    src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx \
    src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx \
    src/main/__tests__/ipc/projection-vlc.test.ts
  ```

  Expected RED: variant contract/routing is absent and remote download commits source playback
  directly.

- [ ] Implement minimum variant propagation. Keep derivative resolution inside the main process and
      current owned VLC startup. Preserve existing projection recovery and sync
      supersession/authorization guards; do not add a second job queue or expose paths.
- [ ] Increment a renderer-local replay revision in `reduceProjectionRenderState()` and pass it
      through `ProjectionPage` to the embedded VLC start effect. It is not persisted or sent over
      IPC; it only makes same-generation recovery replay restart VLC once.
- [ ] Re-run focused suites and commit:

  ```bash
  git add src/shared/ipc-channels.ts src/shared/projection-messages.ts src/main/ipc/validate.ts \
    src/renderer/src/lib/presentation-readiness.ts \
    src/renderer/src/lib/media-projection-payload.ts \
    src/renderer/src/lib/media-projection-sync.ts \
    src/renderer/src/lib/projection-render-state.ts \
    src/renderer/src/pages/ProjectionPage.tsx \
    src/renderer/src/components/Projection/FileProjection.tsx \
    src/main/ipc/projection-vlc.ts \
    src/renderer/src/contexts/ProjectionContext.tsx \
    src/renderer/src/components/Control/ProjectionRecoveryNotice.tsx \
    src/renderer/src/lib/__tests__/presentation-readiness.test.ts \
    src/renderer/src/lib/__tests__/media-projection-payload.test.ts \
    src/renderer/src/lib/__tests__/media-projection-sync.test.ts \
    src/renderer/src/lib/__tests__/projection-render-state.test.ts \
    src/renderer/src/pages/__tests__/ProjectionPage.test.tsx \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx \
    src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx \
    src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx \
    src/main/__tests__/ipc/validate.test.ts src/main/__tests__/ipc/projection-vlc.test.ts
  git commit -m "feat: project normalized Matroska safely"
  ```

### Task 7: Add deterministic packaged VLC fixtures and assertions

**Files:**

- Create: `e2e/fixtures/vlc/README.md`
- Create: `e2e/fixtures/vlc/manifest.json`
- Create: small fixed healthy MP4/MKV, broken-cues-readable MKV, and unreadable-truncated MKV fixtures
- Create: `e2e/helpers/vlc-fixtures.ts`
- Modify: `e2e/electron-packaged.spec.ts`
- Modify: `playwright.electron.config.ts`
- Modify: `.github/workflows/build-release.yml`

**Interfaces:**

- Fixture manifest records file name, SHA-256, codec/container expectation, expected readable
  duration range, allowed container diagnostics, expected seekability/remux outcome, and provenance.
- Packaged evidence attaches app/VLC stdout/stderr, fixture manifest/hash, remux metadata, screenshot,
  and trace on failure.

- [ ] Create sub-megabyte fixed fixtures using a known development encoder; do not depend on the
      packaged LGPL/Windows FFmpeg runtimes having an H.264 encoder. Document generation/provenance
      and commit the exact SHA-256 manifest.
- [ ] Make `vlc-fixtures.ts` verify every hash/size, EBML header, and manifest-declared Matroska
      element IDs. For healthy/broken-cue files, run bundled FFmpeg with
      `-nostdin -v error -i <fixture> -map 0 -progress pipe:1 -nostats -f null -`, require exit zero,
      compare final `out_time_us`/`out_time` with the manifest duration tolerance, and reject every
      stderr diagnostic not explicitly allowlisted by that fixture's manifest. Healthy fixtures
      allow no error diagnostics; broken-cue fixtures allow only their declared container-index
      diagnostics, never packet/decode errors. For the unreadable fixture, add `-xerror` and require
      non-zero exit. Do not depend on system FFprobe.
- [ ] For broken cues, assert the committed byte structure contains readable Cluster elements and
      the manifest-declared Cue/SeekHead corruption. Keep deterministic non-seekable behavior in
      Task 1/2 mocked native-state tests; a static local packaged fixture is not a stable proof of
      `isSeekable() === false` across VLC versions.
- [ ] Replace the current `projection-vlc:started` smoke assertion with owner-matched playback-state
      assertions: playing, seekability, duration, and confirmed time after mid-stream seek.
- [ ] Add packaged matrix cases for native healthy MP4 regression, queued initial VLC controls,
      healthy MKV/cache reuse, broken cues, unreadable truncation/retry, and rapid replacement. Keep
      same-ID replacement and delete-during-remux in Task 5 deterministic process-controlled tests;
      do not add production test hooks to slow tiny fixtures.
- [ ] Add a packaged restart case that creates one remux temp older than 24 hours and one younger
      temp under the dynamic test profile. Restart the app and assert only the stale temp is removed,
      proving main startup wiring without delaying window readiness.
- [ ] Configure Playwright trace as `retain-on-failure` and attach bounded main-process/VLC stderr;
      do not add retries to mask deterministic failures.
- [ ] Add an `if: always()` workflow artifact step for `playwright-report/electron`, `test-results`,
      and bounded app/VLC logs on both package jobs. Keep installer upload success-only and keep
      `--publish never`.
- [ ] Build and run the macOS unpacked package with an explicit executable:

  ```bash
  npm run build:unpack
  PACKAGED_APP_PATH="dist/mac-arm64/HHC Presenter.app/Contents/MacOS/HHC Presenter" \
    npm run test:e2e:packaged -- --grep "VLC production matrix"
  ```

- [ ] Confirm RED against the pre-fix revision or archived baseline where started was the only
      success signal; confirm GREEN on the implementation branch.
- [ ] Commit fixtures/tests separately:

  ```bash
  git add e2e/fixtures/vlc e2e/helpers/vlc-fixtures.ts \
    e2e/electron-packaged.spec.ts playwright.electron.config.ts \
    .github/workflows/build-release.yml
  git commit -m "test: cover packaged VLC reliability"
  ```

### Task 8: Run production gates and open the PR

**Files:**

- No planned source changes; review every changed file against the spec and current `origin/main`

**Interfaces:**

- Produces evidence for local quality, browser compatibility, macOS package, Windows package, and
  installed-device smoke. These gates are independent; one does not imply another.

- [ ] Run all focused suites from Tasks 1-7, then:

  ```bash
  npm run lint
  npm run typecheck
  npx vitest run
  npm run build
  npm run test:e2e
  git diff --check
  ```

- [ ] Run the local macOS unpacked VLC production matrix again and retain its report.
- [ ] Request an independent correctness review of the entire branch. Fix every Critical/Important
      finding and rerun affected plus full verification.
- [ ] Push the branch and open one PR with source-hash, responsiveness, failure-matrix, and local
      macOS evidence. Do not merge.
- [ ] Dispatch the existing `Build and Release` workflow against the PR branch through
      `workflow_dispatch`. Verify both matrix jobs package with `--publish never` and pass
      `PACKAGED_APP_PATH` smoke:

  ```bash
  gh workflow run build-release.yml --ref fix/vlc-production-reliability
  RUN_ID=''
  for attempt in {1..12}; do
    RUN_ID=$(gh run list --workflow build-release.yml --commit "$(git rev-parse HEAD)" \
      --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
    test -n "$RUN_ID" && break
    sleep 5
  done
  test -n "$RUN_ID"
  gh run watch "$RUN_ID" --exit-status
  ```

- [ ] Verify the workflow produced macOS arm64 and Windows x64 artifacts but no GitHub Release, tag,
      updater publication, or deployment.
- [ ] Install the unsigned test artifacts on one macOS and one Windows device. Run visible playback,
      confirmed mid-stream seek, rapid item replacement, recoverable broken-cue playback, unreadable
      failure/retry, and UI responsiveness checks; record app version, OS, architecture, fixture hash,
      and result.
- [ ] Stop and report evidence. Merge requires explicit user authorization after CI, both packaged
      jobs, and both installed-device smoke gates are green. Release remains out of scope.

## Plan self-review

- Every confirmed failure class maps to a RED test and an owner/fingerprint boundary.
- `seekable` travels through validator, coordinator, bridge, Zustand, and both pointer/keyboard UI.
- Local and remote Matroska use the same derivative without bypassing sync authorization/supersession.
- Cache reuse, source replacement, delete/remux races, storage limits, timeout, and crash remnants are
  explicit.
- Recoverable container damage and unreadable packet truncation have different fixtures/outcomes.
- `projection-vlc:started`, unit tests, CI, packaged automation, and installed-device smoke remain
  separate evidence gates.
- No second VLC player, renderer retry loop, import-time remux, durable remux job table, re-encoding,
  dependency addition, tag, release, or deployment is introduced.
