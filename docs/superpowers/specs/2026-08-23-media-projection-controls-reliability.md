# Media Projection Controls Reliability

## Goal

Make the routed `/media` workspace the authoritative operator control surface for a live Media
projection. Closing the controls must close the projection window first, and failed closes must
preserve the live session and controls.

## Required behavior

- Header, keyboard, preview, and context-menu Media starts enter `/media` only after at least one
  item is ready.
- `/media` remains a full-window control workspace without app Header, Sidebar, Floating Timer, or
  a global `NowProjectingBar`.
- Header close, final-screen close, and final `Escape` await projection close before clearing Media
  state. A close failure stays on `/media`, preserves the playlist and resource locks, and shows the
  existing projection-close error toast. Electron also retains the projection coordinator snapshot
  until native close succeeds, so a failed close remains replayable and controllable.
- Browser history/navigation away from an active `/media` route uses the same close transaction.
  The navigation proceeds only after close succeeds.
- An externally closed projection window clears Media state and returns the empty `/media` route to
  Files.
- Every explicit Media start creates a new session revision. The projection sync treats a changed
  revision as a new start even when Media state was already active, so an unexpected Timer or Bible
  owner cannot suppress the explicit Media action.
- Reaching the end screen does not clear Media state by itself. Only an explicit close action or an
  externally observed projection close ends the session.

## Non-goals

- Do not add `NowProjectingBar`, blackout/resume controls, or a background Media bridge that lets
  operators browse other app pages while Media projection continues.
- Do not change Timer's deliberate owner-reclaim behavior or Bible projection semantics.
- Do not merge, tag, publish, or alter release assets in this work.

## Acceptance gates

- Focused tests prove close success ordering, close-failure retention, browser-back blocking,
  end-screen ownership, revision changes, and owner reclaim.
- Existing Media lifecycle, Layout, Header, shortcut, projection-sync, and browser E2E coverage pass.
- Full unit tests, lint, node/web typechecks, and production build pass.
- The PR clearly separates automated verification from packaged Electron/Windows smoke, which is
  outside this code-only change unless explicitly run.
