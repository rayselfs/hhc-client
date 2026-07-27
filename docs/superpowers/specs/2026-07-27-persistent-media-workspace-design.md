# R4 Persistent Media Workspace Design

## Status

Approved on 2026-07-27.

## Goal

Let an operator browse, search, preview, and prepare Media while the current projection remains
live. Replacing or stopping live output must always be an explicit action.

## Product rules

- Projection output and the currently visible control route are independent.
- Leaving Media Workspace never stops, blanks, or closes projection.
- Preview never changes projection ownership or output.
- Only an explicit Present action replaces live content.
- Stop Content keeps the projection window open and shows an intentional black output.
- Close Projection ends the projection session, clears replay state, and closes the window.
- `DefaultProjection` remains an internal fallback and is never used as intentional black output.
- Reload, display move, and bounded crash recovery replay either the latest content or intentional
  blackout without foregrounding projection.
- Existing R0 one-shot foreground behavior and the projection owner rule remain unchanged.
- Browser mode uses the same state model and reports popup/readiness failures truthfully.

## Selected architecture

### Routed operator surfaces

- `/media` is the full Media Workspace.
- `/files` remains the Media library.
- `/files/preview/:itemId` is a nested safe-preview route.
- `FilesPage` owns the nested preview outlet so folder, search, sort, selection, and scroll state
  stay mounted while preview opens and closes.
- Editable LibrePresenter presentations continue to open in `/presentations/:itemId`.
- Imported presentation files may be safely previewed before an explicit Present action.

The current fixed, full-application `MediaPresenter` overlay is replaced by `MediaWorkspacePage`.
The route determines whether the operator workspace is visible; it does not determine whether a
Media live session exists.

### Global Media projection bridge

`MediaProjectionBridge` is mounted once inside `Layout`, under `ProjectionProvider`. It owns:

- `useMediaProjectionSync()`;
- projection playback-state subscriptions;
- synchronization of Media navigation and replay-safe controls;
- ending or blacking out a Media session after an explicit command.

No route component owns projection cleanup. Unmounting Files, Preview, or Media Workspace has no
projection side effect.

### Live state versus workspace state

The Media store keeps live-session state:

- prepared playlist and immutable readiness snapshot;
- current live item and type-specific playback state;
- live projection status;
- resource locks required by the live snapshot.

Route-local or Files workspace state keeps:

- preview item;
- search text;
- selected files;
- sort and view preferences;
- preview-only playback, page, zoom, and pan state.

Preview state is never copied into live state until Present succeeds. A successful Present action
creates or replaces the live snapshot atomically and then navigates to `/media`.

### Projection session summary

`ProjectionContext` exposes a small read-only `ProjectionSessionSummary` derived from the R3
coordinator:

```ts
interface ProjectionSessionSummary {
  owner: ProjectionOwner | null
  status: 'closed' | 'opening' | 'connected' | 'projecting' | 'degraded' | 'failed'
  label: string | null
  isBlackout: boolean
  failure: ProjectionFailure | null
}
```

The summary contains operator-safe metadata only. It does not duplicate the replay snapshot or
become another source of projection truth.

Status precedence is deterministic:

1. `failed` when R3 recovery is failed.
2. `opening` when R3 recovery is opening or recovering.
3. `closed` when no projection window exists.
4. `degraded` when projection is ready but the active Media readiness report contains skipped or
   failed entries.
5. `projecting` when projection is ready and content is visible.
6. `connected` when projection is ready and intentional blackout is active.

### Intentional blackout

R4 adds a replayable `isBlackout` field to `ProjectionSessionSnapshot` and a
`__system:blackout` message. Blackout is orthogonal to owner and content:

- enabling blackout preserves the latest owner and content snapshot;
- the projection renderer shows a pure black surface and stops native/VLC playback;
- disabling blackout restores the retained content atomically;
- reload, display move, and crash replay the same blackout state;
- `DefaultProjection` is not rendered for intentional blackout.

`showDefault` remains only for the existing internal fallback migration and is not exposed as a
user command. R7 may remove it after all internal fallback paths are audited.

## User interface

### Media Workspace

The routed workspace preserves the current Presenter layout and keyboard behavior:

- header with Back to Files, elapsed time, readiness summary, and projection status;
- primary current-item preview and playback controls;
- next-item preview and notes;
- playlist/grid navigation;
- explicit Stop Content and Close Projection commands.

Back to Files performs navigation only. Escape follows this priority:

1. close transient grid;
2. reset zoom;
3. pause an actively playing preview when appropriate;
4. return to Files.

It never stops projection.

### Safe Preview

Double-clicking a presentable file opens the nested preview inspector. The inspector:

- uses preview-local playback state;
- displays readiness and unsupported/missing errors;
- offers Close and Present;
- never calls `startProjection`, `project`, `claimProjection`, or Media live-store navigation
  during load or interaction;
- closes back to the exact mounted Files workspace state.

Double-clicking a folder still opens the folder. Editable presentations keep their existing
explicit editor-open behavior.

### Now Projecting mini bar

The global mini bar appears whenever projection is opening, connected, projecting, degraded, or
failed. It shows:

- connection/status indicator;
- owner and safe current-content label;
- blackout state;
- Return to Media Workspace when a Media live session exists;
- Retry when recovery failed;
- Stop Content when visible content exists;
- Resume Content when intentional blackout is active;
- Close Projection.

The bar is compact and does not cover recovery alerts. It is mounted in `Layout`, including while
the operator is in Timer, Bible, Files, Service, Soundboard, or Presentation Workspace.

## Commands and lifecycle

### Present

1. Run readiness analysis.
2. If the requested item is unavailable, keep Preview open and show the actionable result.
3. Build and lock a live snapshot from ready items.
4. Start or replace the Media projection session.
5. Await the R3 operation result.
6. On success, navigate to `/media`.
7. On failure, retain the prepared snapshot for Retry and expose failed status.

### Back to Files

1. Navigate to `/files`.
2. Preserve Media live state and resource locks.
3. Do not send any projection command.

### Stop Content

1. Stop native/VLC playback.
2. Set replayable blackout.
3. Keep the projection window and retained content snapshot.
4. Keep Media resources locked because Resume Content must remain valid.

### Resume Content

1. Clear replayable blackout.
2. Restore retained content and saved replay controls.
3. Do not foreground projection.

### Close Projection

1. Stop native/VLC playback.
2. Clear the R3 coordinator snapshot and generation.
3. Close the Electron window or browser popup.
4. End Media live state and release resource locks.

An externally closed projection window also clears the corresponding Media live state without
issuing a second close request.

## Error handling

- Popup blocked and readiness timeout remain R3 failures and are visible in both the recovery
  notice and mini bar.
- A readiness report with some skipped entries is `degraded`, not `failed`.
- A requested preview item that cannot be prepared does not replace current live output.
- A failed Present retains current live output and leaves Preview available for Retry.
- A missing live source after recovery becomes `failed`; it never silently advances to another
  playlist item.
- Closing Preview or navigating away never converts an operation failure into success.

## Accessibility and responsive behavior

- Status changes use `role="status"` and polite live announcements.
- Destructive Close Projection remains visibly distinct from Stop Content.
- Icon-only controls have localized accessible labels and tooltips.
- Keyboard focus returns to the originating file after Preview closes.
- At narrow widths the mini bar collapses labels before hiding essential state or actions.
- Media Workspace stacks its sidebar below the primary preview at the shared R7 compact
  breakpoint; R4 must not introduce new fixed desktop-only minimum widths.

## Testing and acceptance

### Unit and component tests

- Media Workspace unmount sends no stop/close command.
- Back to Files preserves live playlist, item, replay state, and resource locks.
- Stop Content produces blackout while the window remains open.
- Resume restores retained content without a foreground call.
- Close Projection clears coordinator and Media state exactly once.
- Safe Preview load and interaction do not send projection commands.
- Present from Preview replaces output only after readiness succeeds.
- Mini-bar status precedence and actions match the deterministic mapping.
- Intentional blackout renders black, not `DefaultProjection`.

### Integration and E2E

- Start video projection, return to Files, search and preview another item, and confirm the first
  video remains live.
- Present the previewed item and confirm output changes once.
- Reload projection while Media Workspace is closed and confirm live state replays.
- Black out, reload projection, and confirm it remains black until Resume.
- Browser popup blocked reports failure and Retry works.
- Packaged Electron smoke covers Back to Files, blackout/resume, and Close Projection.

## Scope exclusions

- Media transcoding, storage accounting, background preparation queue changes, and ingest
  observability belong to R6.
- Presentation editor ribbon and slide-editing expansion belong to R5.
- Global workspace primitive consolidation belongs to R7.
- Projection history stacks, multiple simultaneous projection windows, and persistent sessions
  across full application restart are not included.
