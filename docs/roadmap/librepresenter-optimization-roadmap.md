# LibrePresenter Reliability, Media, and Presentation Optimization Roadmap

## Purpose

This roadmap follows the implemented M1–M9 product roadmap. It focuses on making LibrePresenter
safe and predictable in a live room before expanding its PowerPoint-like editing surface.

The order is deliberate:

1. Protect persisted data and projection sessions.
2. Make Presentation editing trustworthy.
3. Decouple live projection from the current control workspace.
4. Expand the desktop editor and professional Media workflow.
5. Consolidate shared responsive workspace primitives.
6. Finish with cleanup, performance, and release-grade dual-mode verification.

## Product principles

- Live output reliability outranks visual polish.
- Explicit projection commands may change output; page navigation may not.
- Operator preview and live projection are separate states.
- Leaving a control workspace must not implicitly close a healthy projection session.
- The current projected content, selected content, and edited content must remain visibly distinct.
- Electron is the professional target. Browser mode remains supported with explicit degraded
  behavior where desktop parity is impossible.
- Prefer narrow coordinators, adapters, journals, and replayable snapshots over generic command
  frameworks or speculative abstractions.

## Scope exclusions

- YouVersion Bible source migration is deferred to a future dedicated Bible Provider Foundation.
- Full PowerPoint feature parity is not a goal.
- PPTX export, collaboration, CRDTs, event sourcing, and microservice decomposition are not part
  of this roadmap.
- Apple notarization and Windows signing remain separate release decisions.

## Roadmap

| Phase | Status   | Outcome                                                                                                                                       |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R0    | Complete | Projection foreground behavior is predictable and foundational risks are covered by real dual-mode gates.                                     |
| R1    | Complete | File and presentation persistence failures cannot silently lose or fabricate state.                                                           |
| R2    | Complete | Presentation editing has transactional Undo/Redo, serialized saving, visible save state, and safe lifecycle gates.                            |
| R3    | Complete | Projection survives reload, crash, display changes, and browser popup failures through session replay and recovery.                           |
| R4    | Planned  | Media projection remains active while the operator previews, searches, and prepares the next source.                                          |
| R5    | Planned  | Presentation Workspace follows a PowerPoint-like desktop information architecture with essential editing operations.                          |
| R6    | Planned  | Media import, readiness, playback, storage, and slide delivery are observable, recoverable, and performant.                                   |
| R7    | Planned  | Shared responsive workspace primitives replace fixed page-specific layouts; dead paths are removed and release gates cover packaged behavior. |

## R0 — Immediate projection behavior and quality baseline

### Goal

Deliver small, already-defined projection corrections while establishing deterministic regression
coverage for later session work.

### Work

- Add Electron-only one-shot projection foreground behavior:
  - restore a minimized projection;
  - move projection to the top of z-order without taking focus;
  - never use `alwaysOnTop`;
  - never repeat foreground movement for timer ticks or passive synchronization.
- Apply the foreground request to explicit Timer, Bible, and Media output commands.
- Route Timer Space start/resume through the same projection command as its buttons.
- Add browser projection E2E to the PR quality gate.
- Define packaged Electron projection smoke coverage for Windows and macOS release gates.

### Acceptance gates

- A Timer start brings projection forward once.
- Covering projection during Timer keeps it covered on every later timer tick.
- Explicit Bible and Media content changes bring projection forward once.
- Page navigation, readiness messages, pan/zoom, playback state, and component remount do not
  change desktop z-order.
- Browser mode never attempts desktop focus or z-order APIs.

### Progress — 2026-07-26

- [x] Electron one-shot foreground for explicit Timer, Bible, and Media output.
- [x] Timer Space start/resume parity with the Timer buttons.
- [x] Passive Timer ticks, Media pan/zoom, playlist metadata, and remount synchronization remain
      transport-only.
- [x] One-shot foreground regression suite: 156 tests passed.
- [x] Packaging and lifecycle regression suite: 24/24 tests passed.
- [x] TypeScript checks, ESLint, and production build with bundle budgets passed.
- [x] Browser production projection E2E runs in PR CI and passed locally.
- [x] Windows and macOS packaged Electron projection smoke runs in release CI.
- [x] Desktop packaging rejects a missing `electron-vlc-player` native binding before packaging,
      and a damaged app can still boot with VLC reported unavailable.
- [x] Windows VLC/FFmpeg runtimes are checksum-pinned; the unpacked Windows executable passed
      runtime validation and the real Timer control/projection lifecycle smoke.
- [x] macOS uses the official checksum-pinned VLC arm64 distribution and builds FFmpeg 8.1.2 from
      checksum-pinned official source with LGPL-only configure flags on the arm64 release runner.

The Windows path-specific test assertions recorded during R0 were corrected during the R2
closeout. The fresh full Windows-hosted suite now passes. The macOS packaged lifecycle remains
enforced by release CI and cannot be executed on this Windows host.

## R1 — Persistence integrity

### Goal

Make storage failures explicit and recoverable before editor and Media workflows create more
write paths.

### Work

- Stop converting IndexedDB load/write failures into empty or successful results.
- Add initialization, degraded/read-only, dirty, retry, and failure state where authoritative
  stores need it.
- Roll back optimistic mutations or retain a retryable dirty operation when persistence fails.
- Add a cleanup journal/tombstone for native files and external resources.
- Make editable presentation creation compensatable across catalog, blob, derived document, and
  thumbnail writes.
- Detect orphan blobs and reference-count mismatches from actual references.
- Preserve the distinct Bible hard-delete and File Explorer soft-delete policies.

### Acceptance gates

- A database read failure cannot create a replacement empty library.
- A failed move, copy, rename, delete, or save cannot be reported as durable success.
- Restart produces a catalog, blob, trash, and derived-document state consistent with the last
  confirmed transaction.
- Failed native cleanup remains visible and retryable.

### Progress — 2026-07-26

- [x] Shared folder IndexedDB reads, writes, deletes, and trash operations propagate failures
      instead of returning fabricated empty or successful results.
- [x] Bible and File Explorer stores expose initializing, saving, degraded, pending, and retry
      state without replacing a failed load with a new empty root.
- [x] Optimistic folder/item mutations use a serialized retryable queue; failed operations retain
      ordering and block later writes until retry succeeds.
- [x] Lazy parent loads remain retryable and do not poison `loadedParents` after failure.
- [x] Files and Bible custom folders show accessible load/save failure alerts and the appropriate
      retry action.
- [x] Focused R1 folder persistence verification: 106/106 tests, Node/Web typechecks, and touched
      file ESLint pass.
- [x] File Explorer database v5 persists a native/external cleanup journal in the same transaction
      that removes the final catalog Blob reference; startup and Recovery Center retries retain
      failures instead of swallowing them.
- [x] Compensatable editable-presentation creation across catalog, blob, document, and thumbnail
      writes.
- [x] Orphan blob and reference-count audit derives expected counts from File Explorer file items
      and sync entries; Recovery Center repair corrects mismatches and journals zero-reference
      cleanup.
- [x] Projection resource locks still defer final source cleanup; item thumbnails may be removed
      immediately without invalidating the active projection source.
- [x] Diagnostics report cleanup counts and attempts without exposing Blob IDs, native paths, or
      raw cleanup errors.
- [x] Final R1 verification: 87/87 focused tests across 11 files, Node/Web typechecks, touched-file
      ESLint, production Electron/Vite build, PWA precache budget, font budget, and largest-JS
      bundle budget passed.

## R2 — Presentation Trust Foundation

### Goal

Make editing safe enough that operators can experiment without fearing lost content, corrupted
history, or stale projection output.

### Required design corrections

The revised
[`presentation-trust-foundation-design.md`](../superpowers/specs/2026-07-26-presentation-trust-foundation-design.md)
resolves the required corrections below and must be approved before implementation:

- Own per-open-document sessions above the active routed view.
- Gate tab activation, tab close, route navigation, browser reload, and Electron window close with
  awaitable flush/discard decisions.
- Define `discard()` independently from flush-and-dispose.
- Keep one source of truth for active slide and use stable slide IDs.
- Separate document history from ephemeral selection/editing state.
- Define pointer and text draft begin/preview/commit/cancel contracts.
- Route every opened-document writer, including rename, through one coordinator.
- Define the authoritative persistence record and mirror/reconciliation semantics.
- Commit and flush active drafts before building a projection payload.
- Give thumbnail generation its own revision guard.
- Use the centralized shortcut registry for Undo/Redo.

### Acceptance gates

- One user-visible edit creates one Undo transaction.
- Redo survives tab switching and is cleared only by a new committed edit.
- Older asynchronous writes and thumbnails cannot overwrite newer revisions.
- Save status accurately reports scheduled, in-flight, persisted, and failed revisions.
- Closing or navigating cannot silently discard an active draft.
- Editing and immediately presenting always projects the latest committed content.

### Progress — 2026-07-26

- [x] Approved trust-foundation design implemented with one route-independent session per open
      editable presentation; routed view remounts and tab switches preserve document history.
- [x] Document-only history supports a 30-entry Undo boundary, stable Redo across tab switches, and
      Redo invalidation only after a new committed edit.
- [x] Pointer previews and continuous text editing use explicit draft begin/preview/commit/cancel
      contracts, so one visible interaction creates one transaction and canceled drafts create
      neither history nor persistence.
- [x] One serialized save coordinator per session tracks dirty, saving, saved, failed, scheduled,
      and persisted revisions; only the newest pending revision follows the single in-flight write.
- [x] The source Blob and catalog item commit as the authoritative revision. Derived documents and
      thumbnails are repairable revision-guarded mirrors whose failures remain visible and
      retryable without overwriting newer content.
- [x] Editable rename, tab activation, tab close, route navigation, browser unload warning, and
      Electron main-window close all route through the session lifecycle contract. Electron uses a
      typed one-shot close permit and leaves projection-window close behavior unchanged.
- [x] `activeSlideIdByItemId` is the only workspace active-slide truth. Projection resolves the
      stable slide ID, commits an active draft, flushes the exact revision, and starts from that
      document without a stale slide-zero transition.
- [x] Obsolete direct-save, presentation Undo event, and active-slide index APIs were removed; the
      forbidden-writer search returns no matches under the renderer source.
- [x] R2 focused verification: 17 files and 155 tests passed.
- [x] Full Windows-hosted regression: 195 files and 2,022 tests passed.
- [x] Node/Web typechecks, ESLint with zero errors, production Electron/Vite build, PWA precache,
      font, and largest-JS bundle budgets passed.
- [x] Browser projection E2E passed and confirmed passive Timer ticks remain non-activating.
- [x] Windows unpacked packaging, native VLC/FFmpeg runtime validation, and packaged control plus
      projection lifecycle smoke passed.

## R3 — Projection session recovery

### Goal

Treat projection as a replayable session rather than a best-effort stream of transient messages.

### Work

- Assign a generation to each projection window lifecycle.
- Invalidate readiness on reload, renderer crash, and display move.
- Retain the latest owner, blank state, content snapshot, and replay-safe control state.
- Replay the session snapshot after each `__system:ready`.
- Prevent stale buffered commands from crossing projection generations.
- Surface browser popup blocked and readiness timeout as recoverable results.
- Recreate or report a crashed Electron projection instead of logging only.

### Acceptance gates

- Moving projection to another display reproduces the same visible state.
- Projection reload/crash either recovers or presents an actionable operator error.
- No command from a closed generation is applied to a new projection.
- `DefaultProjection` remains an internal fallback, not a user-facing blank mode.

### Progress — 2026-07-26

- [x] Each Electron projection-window lifecycle has a monotonically increasing generation.
      Reload, renderer crash, display move, explicit close, and recreation invalidate the prior
      generation and its readiness.
- [x] A route-independent session coordinator retains the latest projection owner and atomic
      render snapshot, reduces replay-safe controls, and replays only after the matching
      `__system:ready`.
- [x] Timer, Bible, image, PDF, native video, and editable-presentation snapshots restore their
      latest committed state. Native video restores seek and volume before resuming the saved
      playing, paused, or ended state.
- [x] Stale readiness and transport messages are rejected at the validator, IPC, adapter,
      coordinator, and projection-page boundaries; the obsolete opened/closed lifecycle bypasses
      were removed.
- [x] Display moves and renderer reloads reproduce the current projection without foregrounding
      it. The first renderer crash is recreated automatically; a repeated crash within 30 seconds
      becomes a visible failed state with an explicit Retry action.
- [x] Manual Retry resets the crash budget. Explicit projection close clears the replay snapshot
      and generation so intentionally closed content cannot return.
- [x] Browser popup blocking and readiness timeout produce visible recoverable states instead of
      reporting a successful projection. Browser production E2E covers reload replay and popup
      recovery.
- [x] `DefaultProjection` remains an internal empty/invalid-payload fallback and is never stored as
      user-selected projection content.
- [x] R3 focused verification: 12 files and 207 tests passed.
- [x] Full Windows-hosted regression: 198 files and 2,048 tests passed.
- [x] Node/Web typechecks, ESLint with zero errors, production Electron/Vite build, PWA precache,
      font, and largest-JS bundle budgets passed. Three existing formatting warnings remain in
      unrelated test fixtures.
- [x] Browser projection recovery E2E passed (2 tests).
- [x] Fresh Windows unpacked packaging, native VLC/FFmpeg runtime validation, and packaged
      control/projection lifecycle smoke passed. macOS packaged recovery remains enforced by
      release CI because it cannot run on this Windows host.

## R4 — Persistent Media and projection workspace

### Goal

Let operators continue searching and preparing content while live output remains uninterrupted.

### Work

- Replace the full-app fixed Presenter modal with a routed workspace.
- Decouple Presenter unmount from projection stop.
- Add a global `Now Projecting` mini bar with connection and current-content state.
- Separate:
  - return to Files;
  - stop current content;
  - close the projection window.
- Make double-click open a safe preview/inspector instead of implicitly presenting a folder.
- Require an explicit Present action to replace live content.
- Expose `Opening`, `Connected`, `Projecting`, `Degraded`, and `Failed` session states.
- Preserve search/browse context when opening and closing previews.

### Acceptance gates

- The operator can return to Files and locate new media without interrupting projection.
- Preview never changes projection ownership.
- Replacing live content is an explicit, visible action.
- Popup/readiness failure cannot look like a successful projection session.

## R5 — PowerPoint-like Presentation Workspace

### Goal

Provide familiar desktop editing structure and the highest-value slide operations without
attempting full Microsoft PowerPoint parity.

### Work

- Add a 44 px document/quick-access bar with Undo, Redo, tabs, save status, and projection split
  action.
- Organize Ribbon commands into Home, Insert, Design, and contextual Picture/Text tabs.
- Make the slide rail resizable and add drag reorder, insert before/after, duplicate, multi-select,
  copy, paste, and delete.
- Add a centered zoomable canvas, contextual inspector, collapsible Notes pane, and status/zoom
  bar.
- Distinguish active edit slide, selected slides, projected slide, and next slide visually.
- Add explicit Present from Beginning and Present from Current Slide commands.
- Add object multi-selection, marquee, keyboard nudge, snap guides, align/distribute, crop UI,
  basic shapes, and lines.

### Acceptance gates

- Common PowerPoint muscle-memory operations have visible commands and standard shortcuts.
- Editing, preview, current projection, and next projection are never represented by one ambiguous
  state.
- Ribbon and panels degrade intentionally at medium and compact widths.

## R6 — Professional Media observability and delivery

### Goal

Make Media preparation and live delivery fast, inspectable, and recoverable.

### Work

- Add a persistent Background Task Tray for import, sync, thumbnail, poster, PDF, and conversion
  work.
- Report per-item success, skipped, failed, retry, and cancellation state.
- Replace the skipped hover badge with an actionable readiness issue drawer.
- Link inline Media failures to Recovery Center without duplicating incident state.
- Keep failed Media inside the session with repair or skip actions.
- Cache loaded editable documents and projection assets by document revision.
- Send slide/asset deltas instead of repeatedly cloning full base64 documents.
- Consolidate editable presentation storage to one canonical document body and correct quota
  accounting.

### Acceptance gates

- Long-running import and preparation remain visible across route changes.
- Every skipped item has a reason and a recovery action where one exists.
- Slide changes do not reload and serialize the complete editable deck.
- Storage accounting reflects canonical document and asset sizes.

## R7 — Shared responsive shell, cleanup, and release gates

### Goal

Consolidate repeated workspace interaction patterns and ensure the resulting app survives real
browser and packaged-desktop lifecycles.

### Shared primitives

- `WorkspaceShell`
- `ProjectionSessionControl`
- `StageViewport`
- `NavigatorRail`
- `InspectorPanel`
- `ReadinessIssueDrawer`
- `BackgroundTaskTray`
- `ResponsivePanelGroup`

### Responsive modes

- Wide: navigator + stage + inspector.
- Medium: two columns + contextual drawer.
- Compact: one primary surface + mutually exclusive sheets/drawers.

### Cleanup and gates

- Remove unused projection context methods/state and dead store actions only after replacement
  paths are verified.
- Remove unused generic trash and route wrappers.
- Keep dependency additions at zero unless a proven platform capability requires one.
- Run browser projection E2E in PR CI.
- Launch packaged Windows/macOS apps in release smoke tests and verify control window,
  projection start, payload delivery, replay, and close.

## Execution order

```text
R0 Immediate Projection Behavior
→ R1 Persistence Integrity
→ R2 Presentation Trust Foundation
→ R3 Projection Session Recovery
→ R4 Persistent Media Workspace
→ R5 PowerPoint-like Presentation Workspace
→ R6 Media Observability and Delivery
→ R7 Responsive Consolidation and Release Gates
```

R1 and R3 may be developed in parallel only after their storage/session contracts are independently
specified. R5 must not begin by rearranging Ribbon components while R2 lifecycle and persistence
contracts remain unresolved.
