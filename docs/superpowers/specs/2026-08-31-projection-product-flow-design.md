# Projection Product Flow Reliability Design

## Goal

Make projection an output-only surface controlled exclusively from the control window, and make
macOS VLC/MKV playback feel like normal local video playback—including on a cold derivative cache—
while keeping PDF navigation reliable in Electron development and packaged desktop builds.

The work is complete only when the operator-visible workflow passes on a real macOS control window
and external projection display. Unit tests, commit count, `projection-vlc:started`, and a packaged
build alone are not acceptance.

## Confirmed failures

### Projection window

1. Media start and explicit content changes currently carry `bringToFront: true` through
   `media-projection-sync`, `ProjectionContext`, preload, and main-process IPC.
2. `WindowManager.bringProjectionToFront()` calls `showInactive()` for a hidden projection and then
   `moveTop()`. The code avoids an explicit `focus()`, but a focusable macOS fullscreen window can
   still activate another native fullscreen Space and blur the control window.
3. The main control window has `acceptFirstMouse: true`, which masks the resulting inactive-window
   first-click behavior instead of preventing the projection from taking focus.
4. Control-window sizing/fullscreen is coupled to external-display presence even though attaching a
   projector should not alter the operator's control workspace.
5. The projection `BrowserWindow` uses macOS native fullscreen. `electron-vlc-player` observes that
   fullscreen state and its `destroy()` may call `setFullScreen(false)` when replacing a player,
   causing the projection to leave fullscreen during a file switch.
6. The external-display workaround uses the `screen-saver` always-on-top level. It covers macOS
   system chrome, but it is not a real fullscreen lifecycle and incorrectly remains above unrelated
   applications.

### VLC playback

1. The first owner-matched `playing` event establishes media readiness and then calls final
   transport. When the requested transport is already play and there is no seek, the implementation
   calls `play()` again and waits for a second `playing` or time event. libVLC does not guarantee a
   second event for redundant play, so startup can remain in `waiting-transport` until the watchdog.
2. `MediaProjectionBridge` computes `hasStarted` with nullish coalescing. Once an initial
   paused-at-zero state stores `false`, later playing state cannot change it to `true`.
3. `VideoPreview` hides both the central-play transition and the timeline behind that stuck state,
   preventing operator seek verification even when VLC is playing.
4. Desktop-engine MKV starts a Chromium `<video>` preview and the projection VLC player at the same
   time. The Chromium path is not authoritative and can stall on Matroska while presenting optimistic
   local state that disagrees with VLC.
5. VLC path resolution, cached-derivative verification, native embed, bootstrap play, and final
   transport have no operator-visible lifecycle. A play request can therefore remain at `00:00`
   with controls claiming playback until a later native event arrives.
6. Cold Matroska preparation performs stream-copy remux and then decodes the complete derivative for
   validation. The second full decode is unnecessary for container validation and adds avoidable
   first-play latency.

### PDF rendering and navigation

1. `PdfPreview` calls `sendCommand()` from inside a functional `setCurrentPage()` updater. The
   command synchronously updates `ProjectionProvider` while React is rendering `PdfPreview`, causing
   the reported cross-component render-phase update warning and breaking subsequent page projection.
2. Renderer preview/projection and the background thumbnail worker share one PDF.js loader even
   though their execution environments differ.
3. Renderer preview/projection should use a real PDF.js Web Worker. If that Worker fails to start,
   PDF.js silently falls back to a fake worker and moves parsing back onto the renderer.
4. The thumbnail pipeline is already inside `thumbnail-render.worker.ts`. PDF.js uses an in-worker
   local handler there because its browser worker bootstrap expects `window`. That is not a renderer
   performance fallback, but it currently emits the misleading `Setting up fake worker` warning.
5. `TT: undefined function` is a non-fatal PDF.js diagnostic for invalid embedded TrueType programs.
   It must not be treated as the page-navigation root cause or hidden globally.

## Product contract

### Control ownership

- The main window is the only operator control surface.
- The Electron projection window never receives keyboard or mouse focus.
- A one-time macOS fullscreen transition may temporarily require a focusable window, but completion
  immediately restores the control window and makes projection non-focusable before content replay.
- Play, pause, seek, volume, item replacement, PDF page changes, Bible content, Timer content, replay,
  and recovery messages never change projection window focus, z-order, fullscreen, or bounds.
- Browser mode retains the same content ownership. The browser may activate a popup during the
  initial user-authorized `window.open`, but the app returns focus to the control window and never
  focuses the projection again during content changes.

### Projection lifecycle

- `WindowManager` owns only main-window creation plus projection open, close, selected-display
  placement, display-change recreation, renderer-crash recovery, and shutdown.
- Projection generation and replay remain authoritative across display moves and renderer recovery.
- Navigation alone does not change the active projection owner. Existing explicit Timer reclaim is
  preserved.
- An explicit close from the control window closes the projection and ends the corresponding media
  session through the existing close transaction.

### Failure behavior

- A content preparation or rendering failure never steals focus or destroys the projection window.
- Until replacement content has a valid frame, projection retains the last successful frame or the
  existing cached preview.
- Unsupported or damaged media returns a typed, recoverable error to the control window and does not
  contaminate the next item.
- A play request never renders an optimistic `playing` state. Preparation is explicit, queued play is
  preserved, and `playing` appears only after the owner-matched native VLC event.
- Warm-cache playback should produce authoritative state within one second. On the current test Mac,
  the 36 MB cold-cache fixture must produce its first advancing frame within three seconds; exceeding
  that budget is a failed acceptance result rather than a successful "responsive" preparation.

## Architecture

### 1. Output-only projection window

On an external macOS display, create a borderless window on the selected display, show it inactive,
and enter Electron simple fullscreen once. Simple fullscreen covers the display without creating a
separate native fullscreen Space and without exposing a fullscreen state that
`electron-vlc-player.destroy()` will exit. The window is focusable only for this initial transition;
afterward restore the control window, make projection non-focusable, and keep it mouse-ignoring.
Never use `alwaysOnTop`, the `screen-saver` window level, `moveTop()`, or content-triggered fullscreen.

On Windows, retain the borderless exact-display-bounds window. It does not require the macOS simple
fullscreen transition or any always-on-top level.

On the primary-display development fallback, preserve the current bounded preview size but apply
the same output-only focus and mouse policy. The control window owns close and display selection, so
the projection does not need interactive native chrome.

Remove the projection foreground operation end to end:

- `bringToFront` options from projection content APIs;
- `bringProjectionToFront()` from `ProjectionContext` and `WindowManager`;
- `projection:bring-to-front` shared IPC, preload API, validators, handlers, and tests;
- automatic foreground intent from Media start and content changes;
- the main-window `acceptFirstMouse` workaround if the output-only regression proves it unnecessary.

External-display presence must not maximize or fullscreen the control window. Control-window state is
independent of projection availability.

Display move and crash recovery create a replacement output-only window, advance generation, finish
the platform-specific display transition, wait for the projection renderer ready handshake, and
replay the coordinator snapshot. No content caller recreates or foregrounds the window directly.

### 2. VLC session boundary

Keep PR #35's valuable main-process-owned VLC session, generation/attempt fencing, owner-matched
state, remux fingerprinting, pending controls, watchdog, typed failures, and source preservation.
Do not add a second player, worker pool, renderer retry loop, or import-time normalization.

VLC owns only its native child view and playback session. Replacing a file hides and destroys the old
child/session after invalidating ownership. It does not own the projection `BrowserWindow` lifecycle.
Simple fullscreen is established before VLC construction and remains outside the player's fullscreen
state.

Matroska keeps its fingerprinted, atomic stream-copy derivative. Validate the completed derivative
with an error-strict packet stream-copy scan (`-c copy -f null`) rather than decoding every frame.
This preserves truncated-payload detection without a second full decode and adds no new process,
worker, persistent job system, or source mutation.

The startup state machine is:

1. Publish owner-matched `preparing` before derivative lookup/remux. Retain play, pause, seek, and
   volume commands received during this phase.
2. Install the source, hide the native child, apply volume, and issue the existing internal bootstrap
   play.
3. On the first owner-matched `playing`, record media readiness and confirmed seekability.
4. If a seek is pending, apply it and wait for owner-matched time confirmation before final transport.
5. If final transport is pause, request pause and finish on owner-matched `paused`.
6. If final transport is play and no seek remains, the first `playing` event already confirms the
   desired transport. Finish startup immediately; do not request redundant play or wait for another
   event.
7. Finishing startup reveals the native child, clears the watchdog and pending transport, publishes
   authoritative `ready`/`playing` state, and only then publishes the VLC-started acknowledgement.

All callbacks continue to verify active session, player, item, attempt, lifecycle, and projection
generation before reading native state or publishing.

### 3. Video control state

For a desktop-engine item, Control does not call the local Chromium media element's `play()` or use
its events as presentation truth. It sends commands to projection and renders the owner-matched VLC
state. Native browser/MP4 preview behavior remains unchanged.

The active video lifecycle is explicit: `preparing`, `ready`, `playing`, `paused`, `ended`, or the
existing typed failure. `hasStarted` is monotonic for the active item:

```text
previous hasStarted OR currentTime > 0 OR isPlaying
```

Item replacement resets it through the existing item-scoped state boundary. A paused-at-zero update
cannot erase a confirmed start for the same item.

The timeline is an availability control, not a started-state control:

- render it once duration metadata is known;
- enable seek only when `seekable === true`;
- retain the existing pending-seek indication until authoritative state confirms position;
- show the central play button before the first start and after end, not over confirmed playback.
- show a non-blocking preparing indicator while VLC is resolving the current item; a queued play may
  auto-start, but the UI must not claim `playing` until VLC confirms it.

### 4. PDF execution environments

Split PDF.js setup by execution environment without adding a new dependency:

- Renderer preview and projection configure and verify the emitted PDF.js worker URL before
  `getDocument()`. A normal renderer load must establish a real Worker handshake in Electron dev,
  browser mode, and packaged Electron.
- The background thumbnail worker continues using the official `WorkerMessageHandler` locally inside
  that already-background worker. It does not spawn a nested worker solely to avoid the word
  "fake". Configure PDF.js verbosity for that job so the expected local-handler warning and
  recoverable embedded-font warnings do not pollute the renderer console; actual job failures still
  return through the typed worker response.
- A renderer Worker startup failure is explicit diagnostic evidence. The UI may show the existing PDF
  load error/retry state, but normal acceptance cannot pass through silent renderer fake-worker
  fallback.

The packaged-runtime check continues proving that the emitted worker is compiled JavaScript and
present in the archive. Add a dev/runtime handshake regression rather than relying only on asset
existence.

### 5. Pure PDF navigation

React state updaters remain pure. Page navigation computes the bounded next page outside the setter,
updates local state, and then sends one command carrying that exact page. Use an item/page ref or a
small existing callback pattern to make rapid repeated commands advance from the latest page without
introducing another store.

Control and projection apply page identity fencing so an old PDF render cannot replace a newer item
or page. While a high-resolution canvas is pending, retain the cached page preview or last valid
frame. Successful rendering replaces it atomically. Render cancellation is normal cleanup and does
not surface as an error.

Invalid embedded TrueType instructions remain non-fatal. Do not globally suppress PDF.js errors or
claim to repair PDF source bytes.

## Verification strategy

### Automated regressions

Write each regression before production code and observe the expected failure.

1. `WindowManager` tests assert macOS external projection enters simple fullscreen once, restores
   control focus, becomes non-focusable, and never uses always-on-top, native fullscreen, or
   content-triggered window mutations. Display move and crash recovery retain the same contract.
2. IPC/preload/renderer contract tests prove the foreground API is removed without leaving an
   untyped escape hatch.
3. Media-sync tests prove start and item replacement send content only.
4. VLC unit tests prove `preparing` publication, queued control retention, and the first owner-matched
   `playing` completing startup exactly once. Remux tests prove derivative validation uses a packet
   stream-copy scan rather than full decode; existing failure and stale-event coverage remains green.
5. Bridge/component tests prove desktop-engine preview never starts Chromium playback, preparing is
   visible without optimistic playing, `false -> playing` makes `hasStarted` true, and the timeline
   follows authoritative duration/seekability.
6. PDF preview tests capture React console errors, issue next/previous and rapid repeated navigation,
   and prove no render-phase cross-component update occurs.
7. PDF worker tests distinguish renderer real-worker setup from the intentional in-background-worker
   local handler.
8. Projection PDF tests prove cached preview retention, page identity fencing, high-resolution
   replacement, render cancellation, and load-failure preservation.

Run focused tests during each TDD cycle, then:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run build:unpack
npm run test:e2e:packaged
```

Browser-mode projection regressions also run because the repository requires Electron/browser dual
mode.

### Desktop fixtures

Use `/Users/rayselfs/Desktop/test` read-only. Do not modify, rename, move, or commit these files.
Verify SHA-256 before smoke so the result names exact source bytes.

| Fixture                                      | SHA-256                                                            | Purpose                                |
| -------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| `ForBiggerBlazes.mkv`                        | `48615bd078cc6a460e5ba07804cd50a44e446ef1fc065e519d85ec967d4ffa7b` | First play, replacement, H.264/AAC MKV |
| `sample_1280x720_surfing_with_audio.mkv`     | `399a2758579292ce2b707b1fdfb8d1d283bd98ca89018d8afad3051ba9faa91b` | Long seek, H.264/Vorbis MKV            |
| `ForBiggerBlazes.mp4`                        | `57985f49ebfe4e44292117b325f6504bf089c1cdcde8653548736b11b2a27f3a` | MKV/native MP4 behavior parity         |
| `create-landing.mp4`                         | `6fa919a359193a777718b195dab547869c39c22f30fff01b57bf3100edef0073` | Longer native playback regression      |
| `1718期-末世警鐘~在神面前存憂傷痛悔的心.pdf` | `48091e9eaac67698e879684fb2025a48d3eca09ebbe3f7fbdad1b6475c3553eb` | 22-page worker, font, rapid navigation |
| `法人登記證書.pdf`                           | `11cdc8e173c0a076430eff9f71b3a620d8820d4fbe949e306a4e100d800b6eeb` | Single-page boundary                   |

Keep the committed deterministic fixtures for CI failure cases:

- `e2e/fixtures/vlc/healthy.mkv`
- `e2e/fixtures/vlc/healthy.mp4`
- `e2e/fixtures/vlc/broken-cues-readable.mkv`
- `e2e/fixtures/vlc/unreadable-truncated.mkv`

### macOS acceptance

Run both `npm run dev` and the unpacked/packaged macOS application with a real external display.

Required observations:

1. Open projection, start Media, switch mixed MP4/MKV content at least 20 times, and confirm the
   control window retains keyboard focus throughout.
2. Confirm projection uses macOS simple fullscreen, remains display-filling, is not always-on-top
   above other applications, and never enters/leaves a native fullscreen Space during replacement.
3. Clear only the task-created derivative for each MKV, then test one cold-cache start and one
   warm-cache start. A single play request is retained through preparation, Control never claims
   playing early, and first advancing frame meets the one/three-second warm/cold budgets.
4. Pause/resume and seek near the beginning, middle, and end of the long MKV. Control and projection
   time/transport agree after confirmation.
5. Confirm the central play button and timeline follow the product contract.
6. Open the 22-page PDF, rapidly navigate forward/backward, jump across pages, and confirm cached
   preview continuity followed by high-resolution replacement.
7. Confirm no React render-phase update warning and no renderer PDF.js fake-worker fallback.
8. Confirm embedded-font diagnostics, if any, do not block page navigation or projection.
9. Run the single-page PDF boundaries and recover from an intentionally unreadable media fixture
   without reopening the application.

## Delivery boundary

This task authorizes implementation, tests, build, and local macOS smoke in an isolated worktree.
Do not merge, tag, publish a GitHub release, update an updater manifest, or deploy without separate
user authorization. Keep the worktree when any acceptance gate remains open.

## Non-goals

- Replacing VLC, FFmpeg, PDF.js, Electron, or `electron-vlc-player`.
- Re-encoding source media or mutating imported files.
- Repairing malformed PDF fonts or unreadable media payloads.
- Adding a second VLC player, a new projection manager abstraction, nested PDF worker solely for
  warning suppression, or a new persistent store.
- Changing Timer/Bible content ownership beyond removing window focus/z-order side effects.
- Treating console suppression, unit-test green status, or commit volume as product acceptance.
