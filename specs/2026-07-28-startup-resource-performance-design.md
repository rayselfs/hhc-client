# Startup and Resource Performance

## Goal

Avoid loading editor-only code during normal app startup and close the remaining resource lifecycle
gaps.

## Design

- Dynamically import presentation loader, persistence, and session factory only when a presentation
  session is first opened.
- Revoke a thumbnail blob URL when its asynchronous load finishes after the hook was cancelled.
- Unsubscribe Whisper download progress when the settings panel unmounts.
- Register Electron development shortcuts only through the existing app-level
  `browser-window-created` hook.

## Non-goals

- Reworking the application provider tree.
- Asset database migration.
- Changing download or window behavior.

## Acceptance

- Startup provider has no static imports of presentation editor runtime modules.
- Cancelled thumbnail loads and unmounted download panels leave no listeners/blob URLs.
- Each Electron window receives one shortcut watcher.
- Focused tests, full Vitest, lint, typecheck, and build pass.
