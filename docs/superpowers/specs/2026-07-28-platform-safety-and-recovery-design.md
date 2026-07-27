# Platform Safety and Recovery Design

## Goal

Close the remaining verified second-pass findings in browser projection transport, VLC IPC,
background-task status, and Recovery Center behavior.

## Verified Root Causes

1. Browser projection uses one origin-wide BroadcastChannel. Generation numbers restart in every
   control tab, so two tabs can accept each other's traffic.
2. VLC handlers annotate renderer payloads with TypeScript types but do not validate runtime values
   before passing them to a native binding.
3. Background-task counts are calculated after `slice(0, 30)`, so older active or failed jobs are
   omitted from the header state.
4. Recovery Center renders only `actions.slice(0, 1)`, making implemented cancel and diagnostics
   actions unreachable.
5. Recovery exposes Projection filter/action types even though no projection-health issue source
   exists, and its indicator only scans once at mount.

## Browser Projection Isolation

Each browser control session owns one random UUID. The ID is passed to its projection popup in the
hash URL and used in every BroadcastChannel envelope alongside:

- `generation`
- `sessionId`
- `senderRole`
- `sender`
- `channel`
- `data`

An adapter accepts a message only when session ID and generation match, the sender role is the
opposite role, and the sender instance differs. The popup window name also includes the session ID
so a second control tab cannot reuse the first tab's projection window.

Electron IPC remains generation-based and unchanged.

## VLC IPC Validation

Validate unknown payloads at each main-process handler before native calls:

- start: non-empty item ID, valid native file ID, exact known container, finite non-negative
  duration/position, volume in `[0, 1]`, and known replay state;
- probe: valid native file ID;
- control: known action, optional non-empty item ID, finite non-negative seek, and volume in
  `[0, 1]`.

Invalid payloads throw before runtime loading or player mutation. Renderer-side clamping remains a
UX convenience, not a trust boundary.

## Background Task Status

Use all jobs for active and issue counts. Keep the 30-row limit only for the expanded render list.
No pagination or new store is introduced.

## Recovery Center

- Render every action already supplied by `collectRecoveryIssues`.
- Use the existing confirmation dialog for destructive actions.
- Remove the dead Projection filter, `projection-health` kind, and `reopen-projection` action/type
  and locale strings.
- Migrate persisted `projection` filter state to `all`.
- Refresh the indicator initially, on media-job database changes, and when the window regains focus.
- Exclude dismissed issue IDs from the indicator count.

No projection-health collector is invented without an authoritative health source.

## Verification

- Broadcast adapter tests prove cross-session and same-role messages are ignored.
- Projection context/page tests prove the session ID travels through popup URL and adapters.
- VLC handler tests prove malformed and non-finite values cannot reach the native player.
- Background tray tests prove jobs after row 30 still affect the header.
- Recovery tests prove all actions render, destructive cancel confirms, dead Projection UI is gone,
  legacy filter state migrates, and the indicator refreshes.
- Focused tests, typecheck, lint, full Vitest, and production build must pass.

