# Projection Session Recovery Design

## Status

Approved in conversation on 2026-07-26. This design defines the R3 lifecycle, generation,
snapshot, replay, crash-recovery, browser-failure, operator-feedback, and verification contracts.

## Summary

Projection currently behaves as a best-effort message stream. The control renderer buffers some
messages until `__system:ready`, but it does not retain a complete replayable session. Electron
reports a projection renderer crash only to the console, moving the window closes and recreates it
without a generation contract, and an existing Electron window is treated as ready without a new
handshake. Browser popup blocking and readiness timeout discard work without an actionable result.

R3 introduces two narrow authorities:

1. Electron `WindowManager` owns projection-window lifecycle and monotonically increasing
   generations.
2. A control-renderer `ProjectionSessionCoordinator` owns the in-memory replay snapshot and reduces
   incremental commands into replay-safe final state.

Each projection renderer announces readiness for one generation. The coordinator accepts only the
current generation and sends one atomic replay snapshot. Reload, display move, and one bounded
automatic crash recovery preserve the snapshot. An explicit close ends the session and clears it.

## Goals

- Reproduce the last visible Timer, Bible, or Media state after projection reload.
- Reproduce the same state after moving projection to another display.
- Automatically rebuild an Electron projection after its first renderer crash.
- Stop automatic crash loops and surface an actionable failure after a second crash within 30
  seconds.
- Restore Media position and playing/paused state with at most the normal playback-report delay.
- Prevent messages, callbacks, and readiness signals from an old generation from reaching a new
  projection.
- Return explicit recoverable results for browser popup blocking and readiness timeout.
- Preserve the one-shot foreground contract: recovery replay and passive synchronization never
  move projection to the top.
- Keep Electron and browser behavior aligned without moving domain payload ownership into the main
  process.

## Non-goals

- Restoring a projection session after the entire application restarts.
- Persisting projection snapshots in IndexedDB or the filesystem.
- Building the R4 `Now Projecting` mini bar or the routed Media workspace.
- Changing Timer, Bible, Media, or Presentation ownership rules.
- Exposing `DefaultProjection` or blank output as a user-facing projection mode.
- Creating a command log, event-sourcing system, generic command framework, or new dependency.
- Recovering a crashed main control renderer.
- Implementing macOS packaged verification on a Windows development host.

## Alternatives considered

### Main-process snapshot authority

Every payload could be routed through and retained by Electron main. Crash recovery would be
centralized, but main would need to understand Timer, Bible, Presentation, PDF, image, and video
state. Browser mode would need a separate authority. This creates unnecessary domain coupling and
is rejected.

### Extend the current pending-message map

The existing `ProjectionContext` map could gain generation tags and keep buffering channel
messages. This is a small diff, but it cannot distinguish replayable state from one-shot commands.
Old `play`, `seek`, or pan commands could cross a generation, and an already-ready session still
would not have a complete snapshot. This does not satisfy R3.

### Selected approach

Use a hybrid lifecycle/session design. Electron main owns window identity, generation, crash
classification, and recreation. The control renderer owns one typed in-memory snapshot. A small
pure coordinator reduces messages and produces replay state. The projection renderer applies one
snapshot atomically.

## Responsibility boundaries

### `WindowManager`

`WindowManager` owns:

- the current projection `BrowserWindow`;
- the current projection generation;
- the selected display for that generation;
- lifecycle reasons and events;
- one bounded automatic crash recovery;
- intentional-close versus replacement-close classification.

It does not store Timer, Bible, Media, or Presentation payloads.

### `ProjectionSessionCoordinator`

The coordinator owns:

- whether a replayable session exists;
- the current generation observed from the transport;
- the latest owner and internal fallback state;
- the latest replay-safe domain snapshot;
- readiness timeout and stale-callback invalidation;
- `closed`, `opening`, `ready`, `recovering`, and `failed` status;
- an actionable public failure reason.

The coordinator is a non-serializable service owned above routed pages by `ProjectionProvider`. It
is not placed in Zustand and is never mounted in the projection renderer.

### `ProjectionContext`

`ProjectionContext` remains the React integration API. It:

- creates and disposes the coordinator;
- adapts Electron lifecycle IPC or browser popup lifecycle into coordinator events;
- exposes status, failure, Retry, and existing projection commands to React;
- forwards incremental projection messages through the coordinator.

It does not independently maintain another pending-message map or replay snapshot.

### `ProjectionPage`

`ProjectionPage`:

- learns its generation before announcing ready;
- rejects replay or incremental messages for other generations;
- applies a complete replay snapshot in one React state transition;
- continues applying matching-generation incremental messages afterward;
- reports Media playback state tagged with the same generation.

## Shared lifecycle contract

```ts
export type ProjectionLifecycleStatus =
  | 'closed'
  | 'opening'
  | 'ready'
  | 'recovering'
  | 'failed'

export type ProjectionLifecycleReason =
  | 'created'
  | 'reload'
  | 'display-move'
  | 'renderer-crash'
  | 'user-close'
  | 'popup-blocked'
  | 'ready-timeout'

export interface ProjectionLifecycleEvent {
  generation: number
  status: ProjectionLifecycleStatus
  reason: ProjectionLifecycleReason
}

export interface ProjectionFailure {
  generation: number
  reason: 'renderer-crash' | 'popup-blocked' | 'ready-timeout'
}
```

Generation is a positive integer scoped to the current application run. It resets when the
application restarts. Zero means no projection generation exists.

Electron main sends lifecycle events only to the control window. Browser mode produces the same
events locally from popup creation, matching readiness, popup polling, and timeout.

## Generation contract

### Electron

- Creating the first projection window allocates a generation before navigation starts.
- A main-frame reload allocates a new generation before the old document can announce readiness.
- Display move intentionally closes the old window, allocates a new generation, and creates the
  replacement on the selected display.
- Crash recovery destroys the unusable window, allocates a new generation, and creates the
  replacement on the previous display.
- Normal window close does not allocate a replacement generation.
- `projection:check` returns the current lifecycle state and generation; existence never implies
  readiness.
- A projection-only lifecycle query returns the generation assigned to that exact window.
- Main validates the sending `webContents` before accepting projection readiness or playback
  reports.

The initial window load must not allocate twice. `WindowManager` records whether the first
navigation has completed; only a later main-frame reload begins another generation.

### Browser

- The control window allocates a generation before `window.open`.
- The generation is encoded in the projection URL and retained across reload of that popup.
- Reopening after a normal close allocates a new generation.
- BroadcastChannel envelopes include generation and sender ID.
- Both roles ignore an envelope whose generation does not match their current lifecycle.

### Callback invalidation

Every readiness timeout, popup poll, recovery callback, and pending entry captures its generation.
Before changing state or sending data, it compares that generation with the current generation.
Disposal or generation replacement invalidates all older callbacks.

## Replay snapshot

The coordinator retains final state rather than a command history:

```ts
export interface ProjectionSessionSnapshot {
  owner: 'timer' | 'bible' | 'media'
  showDefault: boolean
  timer: {
    tick: ProjectionPayload<'timer:tick'> | null
    stopwatch: ProjectionPayload<'timer:stopwatch'> | null
    overtimeMessage: ProjectionPayload<'timer:overtime-message'> | null
    timezone: ProjectionPayload<'settings:timezone'> | null
    ringColor: ProjectionPayload<'settings:timer-ring-color'> | null
  }
  bible: {
    chapter: ProjectionPayload<'bible:chapter'> | null
    settings: ProjectionPayload<'bible:settings'> | null
  }
  media: {
    show: ProjectionPayload<'file:show'> | null
    state: ProjectionMediaReplayState | null
  }
}

export interface ProjectionMediaReplayState {
  itemId: string
  positionSeconds: number
  durationSeconds: number
  isPlaying: boolean
  isEnded: boolean
  volume: number
  pdfPage: number
  pdfScroll: number
  pdfViewMode: 'single' | 'continuous'
  zoom: number
  pan: { x: number; y: number }
}
```

Defaults use the current product defaults for volume, first PDF page, scroll origin, single-page
mode, zoom, and pan. The implementation plan must copy those existing values rather than inventing
new UI preferences.

`ProjectionSessionSnapshot` is memory-only and contains the same already-transmitted data as the
current projection messages. It is cleared on session end.

### Snapshot reduction

- `startProjection(owner, payloads)` begins or replaces the active session, records owner,
  unblanks internally, and reduces all initial payloads before opening the window.
- Timer, stopwatch, timezone, ring color, Bible chapter, Bible settings, and `file:show` replace the
  corresponding latest value.
- `file:control` is never appended to a queue. It updates final replay state:
  - `play` sets `isPlaying`;
  - `pause` clears `isPlaying`;
  - `seek` replaces `positionSeconds`;
  - `volume` replaces `volume`;
  - PDF, zoom, and pan actions replace their matching field.
- `file:playback-state` is accepted only when its `itemId` matches the current Media item. It
  refreshes position, duration, playing, and ended state.
- A new `file:show` for another item creates fresh Media replay defaults for that item.
- `file:end` is a one-shot event and is not retained as a future command.
- A projection command may still be sent incrementally to the current ready generation after it
  updates the snapshot.

History is intentionally absent. Only the latest state is replayable.

## Atomic replay contract

Add a system replay message:

```ts
export interface ProjectionReplayPayload {
  generation: number
  snapshot: ProjectionSessionSnapshot
}
```

When a matching projection renderer announces ready:

1. the coordinator cancels the readiness timeout;
2. it marks the generation ready;
3. if a session exists, it sends one `__system:replay` payload;
4. it then permits matching-generation incremental messages.

`ProjectionPage` reduces the replay payload into one render state before displaying domain
content. Media replay state is passed as initial state to `FileProjection`; it is not emitted as a
sequence of controls before the source is ready. This avoids Timer fallback, slide-zero, PDF-page,
or video-position flicker.

If no session exists, ready leaves `DefaultProjection` visible as the internal fallback.

## Lifecycle flows

### Explicit projection start

1. Build the snapshot.
2. Open or locate the projection generation.
3. If an existing generation is not ready, wait for a matching ready signal.
4. Replay the snapshot atomically.
5. Return a successful projection result only after matching readiness and replay dispatch.
6. Apply the existing one-shot foreground behavior for the explicit action.

An already-ready generation receives the updated content incrementally and does not need a new
replay handshake.

### Display move

1. Mark the current generation unavailable.
2. Preserve the session snapshot.
3. Intentionally close the old window with reason `display-move`.
4. Create a new generation on the requested display.
5. Wait for matching ready and replay.

Closing the replaced window must not end the session. Replay itself must not request another
foreground operation.

### Reload

1. Detect a later main-frame navigation.
2. Mark the old generation unavailable.
3. Allocate a new generation and start its readiness timeout.
4. On matching ready, replay the current snapshot.

Late ready or playback reports from the old document are ignored.

### Electron renderer crash

The crash policy is exactly one automatic recovery per 30-second rolling window:

1. On the first abnormal `render-process-gone`, emit `recovering`.
2. Preserve the session and previous display.
3. destroy the unusable projection window;
4. allocate a new generation and create a replacement;
5. replay after matching ready.

If another abnormal projection renderer termination occurs less than 30 seconds after the first,
do not recreate automatically. Emit `failed` with reason `renderer-crash`. Manual Retry resets the
crash window and creates one new generation while preserving the snapshot.

The crash handler must not call `focus`, `alwaysOnTop`, or a second foreground operation.

### Explicit close

These are normal session-ending events:

- control UI calls Close Projection;
- the Electron projection window closes normally;
- the Browser popup is closed by the user.

They:

1. mark the close intentional;
2. clear snapshot, pending work, readiness timeout, and crash budget;
3. emit `closed` with reason `user-close`;
4. do not recreate the projection.

Opening a projection window afterward shows only the internal fallback until an explicit Present
action creates a new session.

## Media recovery

The latest playback report is the authority for replay position and playing/paused state. Outgoing
seek, play, pause, and volume controls update the snapshot immediately so the coordinator does not
wait for a report before it knows the operator's latest intent.

After replay:

- a previously playing item resumes from the latest position;
- a previously paused item restores the position and remains paused;
- an ended item remains ended rather than restarting;
- the acceptable position difference is bounded by the existing playback-report interval, which
  is approximately one second;
- PDF page/view/scroll, image/PDF zoom and pan, editable slide, and PPTX slide restore their latest
  final state.

Both browser media elements and Electron VLC-backed playback use the same replay state. Platform
adapters may apply it differently, but they must produce the same visible and playing/paused
result.

## Public operation results

Projection open/start/retry operations return explicit results:

```ts
export type ProjectionOperationResult =
  | { ok: true; generation: number }
  | {
      ok: false
      generation: number
      reason: 'popup-blocked' | 'ready-timeout' | 'renderer-crash'
    }
```

Existing callers may ignore a successful result, but no caller may convert a failed result into
successful UI state.

### Popup blocked

If `window.open()` returns `null`, browser mode immediately:

- emits `failed` with reason `popup-blocked`;
- retains the session snapshot;
- returns `{ ok: false, reason: 'popup-blocked' }`;
- offers Retry after the operator allows popups.

### Ready timeout

If no matching `ready` arrives within five seconds:

- emit `failed` with reason `ready-timeout`;
- retain the snapshot;
- invalidate the timed-out generation for incremental sends;
- return a failed operation result.

Retry replaces the unhealthy Electron window or Browser popup, allocates a new generation, and
reuses the snapshot.

## Operator feedback

Expose through `ProjectionContext`:

```ts
interface ProjectionRecoveryViewState {
  status: ProjectionLifecycleStatus
  generation: number
  failure: ProjectionFailure | null
}
```

Add a small global `ProjectionRecoveryNotice` inside the control `Layout`:

- `recovering` shows a non-blocking, `aria-live="polite"` recovery message;
- `failed` remains visible and offers a Retry button;
- popup-blocked copy tells the operator to allow popups before Retry;
- ready-timeout and renderer-crash copy do not expose raw Electron reasons, stack traces, paths, or
  payload data;
- successful matching readiness clears the failure notice.

This notice is a narrow R3 recovery surface. R4 may later consume the same state in its
`Now Projecting` mini bar.

## Foreground behavior

R0 remains authoritative:

- explicit Timer, Bible, and Media projection actions may request one non-activating foreground
  operation;
- timer ticks, playback reports, snapshot reduction, readiness, reload replay, display replay,
  crash replay, and manual component remount do not request foreground;
- projection never uses `alwaysOnTop`;
- recovering a minimized or covered projection does not repeatedly move it to the top.

## Dual-mode cleanup and StrictMode

- Adapter and coordinator resources are created in effects or stable refs with explicit disposal.
- Disposal closes timers, polling, listeners, and BroadcastChannel instances.
- React StrictMode remount cannot close or invalidate a newly created adapter through stale cleanup.
- Browser control-window unload may close its popup as today; it also disposes the session.
- Projection-page unload does not emit a closed event. The control window's popup poll is the
  browser authority for a true close, so reload retains the generation and is never misclassified
  as a user close.

## Security and validation

- Main accepts readiness and playback reports only from the current projection `webContents`.
- Only the main control window may ensure, move, retry, foreground, or close projection.
- Lifecycle generation must be a positive safe integer.
- Shared runtime validation covers lifecycle events, ready payloads, replay payloads, and
  generation-tagged browser envelopes.
- Error UI exposes categorized reasons only.
- Snapshot payloads remain in memory and are not written to telemetry or diagnostics.

## Testing strategy

### Pure coordinator

Cover:

- Timer, Bible, and Media snapshot reduction;
- one final state from repeated seek, zoom, pan, page, volume, play, and pause commands;
- latest playback report with item-ID guard;
- new Media item resets item-scoped replay state;
- snapshot preservation across reload, display move, and crash;
- snapshot removal on explicit close;
- matching ready emits one replay;
- old generation ready, timeout, playback report, and pending operation are ignored;
- dispose invalidates timers and subscribers.

### Electron main and IPC

Cover:

- initial create allocates once;
- reload, display move, crash replacement, and manual Retry allocate exactly one new generation;
- display replacement close is not reported as user close;
- first crash recreates on the same display;
- second crash within 30 seconds emits failed without recreation;
- crash after the 30-second window may recover automatically again;
- normal close never recreates;
- projection/unknown windows cannot invoke control-only IPC;
- non-current projection sender cannot announce ready or report playback;
- crash recovery does not focus, pin, or add foreground calls.

### Adapter and renderer

Cover:

- Electron lifecycle and generation APIs are typed through preload;
- BroadcastChannel envelopes reject other sender and generation values;
- Browser reload reuses the URL generation;
- `ProjectionPage` announces matching ready;
- replay applies Timer, Bible, Media, settings, and internal fallback in one state transition;
- Media receives initial replay state rather than a pre-load control queue;
- popup blocked and ready timeout expose failure and retain Retry data;
- successful Retry clears the notice.

### End-to-end

- Browser projection reload restores the last Timer payload without another explicit Present.
- Browser popup blocking produces a recoverable failure rather than success.
- Browser passive timer ticks and replay remain non-activating.
- Windows packaged Electron projection reload restores the last payload.
- Existing Windows packaged control/projection lifecycle smoke remains green.
- macOS packaged recovery remains a release-CI gate because it cannot run on the Windows host.

### Quality gates

- focused R3 Vitest suite;
- complete Vitest suite;
- Node and Web typechecks;
- ESLint;
- production Electron/Vite build and bundle budgets;
- browser E2E;
- Windows unpacked packaging and packaged Electron smoke.

## Acceptance criteria

- Moving projection to another display reproduces the same visible state.
- Projection reload reproduces the same visible state without another operator command.
- One Electron projection renderer crash recovers automatically on the same display.
- A second crash within 30 seconds stops automatic recovery and presents Retry.
- Explicit close clears the session and never recreates projection.
- Playing Media resumes near its latest reported position; paused Media remains paused.
- No stale generation signal, callback, payload, or command reaches the replacement renderer.
- Popup blocked and ready timeout cannot look successful and remain retryable.
- Recovery replay never changes z-order beyond the existing explicit one-shot contract.
- `DefaultProjection` remains an internal fallback only.

## Implementation sequence

1. Add shared lifecycle, generation, operation-result, replay, and snapshot types plus validation.
2. Add the pure `ProjectionSessionCoordinator` and its reducer tests.
3. Make `WindowManager` generation-aware and implement bounded crash recovery.
4. Add typed IPC/preload lifecycle, generation, and Retry operations.
5. Add generation filtering to Electron and BroadcastChannel adapters.
6. Integrate the coordinator into `ProjectionContext`.
7. Apply atomic replay in `ProjectionPage` and initial Media replay in `FileProjection`.
8. Add the global recovery notice and localized copy.
9. Add browser and packaged Electron recovery E2E.
10. Run broad gates and record exact R3 evidence in the roadmap.
