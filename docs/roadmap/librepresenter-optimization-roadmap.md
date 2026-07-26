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

| Phase | Status                   | Outcome                                                                                                                                       |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R0    | Complete                 | Projection foreground behavior is predictable and foundational risks are covered by real dual-mode gates.                                     |
| R1    | Planned                  | File and presentation persistence failures cannot silently lose or fabricate state.                                                           |
| R2    | Design revision required | Presentation editing has transactional Undo/Redo, serialized saving, visible save state, and safe lifecycle gates.                            |
| R3    | Planned                  | Projection survives reload, crash, display changes, and browser popup failures through session replay and recovery.                           |
| R4    | Planned                  | Media projection remains active while the operator previews, searches, and prepares the next source.                                          |
| R5    | Planned                  | Presentation Workspace follows a PowerPoint-like desktop information architecture with essential editing operations.                          |
| R6    | Planned                  | Media import, readiness, playback, storage, and slide delivery are observable, recoverable, and performant.                                   |
| R7    | Planned                  | Shared responsive workspace primitives replace fixed page-specific layouts; dead paths are removed and release gates cover packaged behavior. |

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

The fresh full Windows-hosted test run still reports 14 failures outside the R0 focused gates:
12 path assertions in six main-process test files remain hard-coded for POSIX paths, and two
renderer tests time out only under full-suite parallel load. These are retained as test
infrastructure follow-up work; R0's focused tests, browser lifecycle, Windows packaged lifecycle,
typechecks, lint, and production build pass. The macOS packaged lifecycle is enforced by release CI
and cannot be executed on this Windows host.

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

## R2 — Presentation Trust Foundation

### Goal

Make editing safe enough that operators can experiment without fearing lost content, corrupted
history, or stale projection output.

### Required design corrections

The current
[`presentation-trust-foundation-design.md`](../superpowers/specs/2026-07-26-presentation-trust-foundation-design.md)
must be revised before implementation:

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
