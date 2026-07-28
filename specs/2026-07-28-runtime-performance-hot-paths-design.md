# Runtime Performance Hot Paths

## Goal

Bound recurring work in timer, VLC projection, and LAN mobile control while preserving observable
state transitions.

## Design

- Keep timer remaining time signed until phase calculation so overtime works. Use a one-second
  timer-only interval and the existing 100 ms interval only while stopwatch precision requires it.
- Publish VLC playback state immediately for lifecycle events, but throttle native `timeChanged`
  progress publications to at most four per second.
- Schedule the next LAN mobile snapshot refresh only after the current request settles.

## Non-goals

- A new scheduler abstraction.
- Replacing VLC or the LAN transport.
- Profiling infrastructure.

## Acceptance

- Timer enters overtime with increasing overtime seconds and avoids 100 ms timer-only wakeups.
- Bursty VLC progress events produce at most one state publication per 250 ms window.
- LAN state refresh requests never overlap.
- Focused main-process tests, typecheck, and build pass.
