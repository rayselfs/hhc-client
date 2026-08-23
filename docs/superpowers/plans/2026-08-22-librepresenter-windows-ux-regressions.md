# LibrePresenter Windows UX Regressions Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-22-windows-ux-regressions.md`

## Global Constraints

- Branch `fix/windows-ux-regressions` from latest `origin/main` in an isolated worktree.
- No dependencies or IndexedDB schema changes.
- Keep browser and Electron behavior aligned except native OAuth protocol handling.
- Do not infer HHC roles or weaken server authorization.
- Use TDD and commit each reviewed task separately.

### Task 1: Stable folder interactions

Modify `FolderBrowser.tsx`, `ContextMenuContext.tsx`, and `FolderPersistenceStatus.tsx` with focused
tests. Empty-state descendants must open the empty-area menu, context-menu focus restoration must use
`focus({ preventScroll: true })`, and persistence UI must render initialization/degraded/error states
but not transient ready/saving banners.

### Task 2: Explicit media projection navigation

Modify `FileBrowser.tsx` and `useFileContextMenu.ts` with direct behavior tests. Image/video
double-click and context-menu Project must await existing readiness/projection helpers and navigate
to `/media` only when `summary.ready > 0`. Test ready, zero-ready, and rejection outcomes. Preserve
editable presentation and supported PPTX/PDF behavior.

### Task 3: Remove tray and startup media amplification

Remove `BackgroundTaskTray` from Layout and delete its component/tests. Delete startup
`backfillImportedMediaAssets()` and its dead export/tests. Limit explicit
`refreshImportedMediaAssets()` preparation to three concurrent items. Media-job events may update a
lightweight failed/blocked count but must not trigger `collectRecoveryIssues()` integrity scans.
Full scans remain on mount/focus/explicit refresh and sync/cleanup events. Add `Cache-Control:
no-store` to full/range `hhc-media` responses, pre-optimize `pdfjs-dist` and its worker, and catch/log
startup stale-lease cleanup failure without changing the direct cleanup function's rejection.

### Task 4: Recoverable sign-in lifecycle

Extend the shared auth adapter and Electron IPC/preload plus browser adapter with explicit cancel,
pending expiry metadata, and immediate replacement of abandoned transactions. Generation checks must
discard late `openExternal`, popup message, and protocol completions. A completion/sign-out already
in progress remains exclusive. Use one shared five-minute TTL source. Add service, adapter, context,
and UserMenu tests plus localized cancelled/expired feedback.

### Task 5: Visible permission-aware HHC LINE action

In FilesPage, FAB, and folder context menu, always provide the root HHC LINE action. Enable it only
when claims match the current user and include `media_sync_user`. Render distinct localized visible
and accessible reasons for signed out, claims loading, and missing role. Test both entry points and
ensure disabled actions cannot open the picker.

### Task 6: Remove duplicate Presenter media work

Reduce `usePreviewCache` to PDF cache reading. Delete unused image/video thumbnail state and decode
branches. Presenter observes the existing durable job/cache completion and never starts a second PDF
derivation. Test that non-PDF sources are not loaded and an active `pdf-pages` job remains the sole
generator.

### Task 7: Make Recovery actions truthful and current

Use existing `stringifyRedactedDiagnostics()` to download a JSON Blob and revoke its URL. Offer
integrity repair only for unreferenced blobs and ref-count mismatches; missing references expose
diagnostics only. Reuse the sync change event and add a cleanup-journal change event for Indicator
and Panel refresh. Localize Recovery accessible text and current web upload storage/file-size errors.
Cover each observable behavior.

### Task 8: Clear HHC credentials with all app data

Add an auth-service-owned `clearLocalData()` that invalidates pending auth, clears memory, best-effort
revokes the remote token, and deletes the entire credential record. Pass the service to app IPC and
invoke it from Clear all data; do not duplicate the credential filename in app IPC. Test disk and
memory state before relaunch.

### Task 9: Version and full acceptance

Bump `package.json` and lockfile to `2.3.0`. Run lint, typecheck, full tests, build, browser E2E, and
package checks. Manually verify the reported Electron/browser flows. Build Windows x64 and run
packaged smoke when supported; explicitly report any platform gate that cannot run in this macOS
environment. Do not tag, publish, push, merge, or create a release without separate authorization.
