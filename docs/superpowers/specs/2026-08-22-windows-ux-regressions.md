# Windows UX Regression Fixes Specification

## Required behavior

1. Empty Bible custom folders expose the empty-area context menu.
2. Folder and file mutations do not scroll or shift the current view.
3. Double-clicking image/video starts projection and enters `/media`; editable presentations retain
   editor behavior and imported PPTX/PDF retain their supported behavior.
4. Context-menu projection enters `/media` only after at least one item is ready.
5. Remove the global Background tasks tray. Keep the durable media queue and Recovery Center, but
   remove startup all-media backfill, limit explicit preparation to three concurrent items, avoid a
   full integrity scan per job write, disable Chromium caching for `hhc-media`, pre-optimize pdfjs,
   and make stale native lease cleanup best-effort at startup.
6. Cancelled or abandoned sign-in supports explicit cancel, timeout feedback, and immediate retry in
   Electron and browser modes without weakening PKCE/state checks.
7. HHC LINE root actions are always visible. Disable them while signed out, claims are unresolved,
   or `media_sync_user` is missing, and show a localized accessible reason.
8. Presenter does not decode unused image/video previews and does not race the persistent `pdf-pages`
   generator.
9. Recovery diagnostics downloads redacted JSON, repair appears only for supported issue kinds,
   sync/cleanup changes refresh the UI, and all user-facing text is localized.
10. Clear all data removes the HHC credential record and in-memory authentication state.

## Constraints

- No new dependency or IndexedDB schema.
- Preserve Electron/browser dual mode, system-browser OAuth, PKCE/state verification, server role
  enforcement, and projection ownership.
- Do not delete media, IndexedDB, derived assets, or custom covers during normal startup.
- Work from latest `origin/main`; do not commit to `main`.
- Completion requires focused tests, full lint/typecheck/tests/build, browser E2E, and Windows x64
  packaged smoke evidence. If Windows cannot be executed locally, report that gate as unverified.
