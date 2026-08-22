# M2 Media Library & Sync Reliability Plan

## Goal

Make media and sync state clear enough that an operator knows what is ready, what is downloading, what is unsupported, and what needs attention.

## Key Changes

- Keep File Explorer as the asset library.
- Keep sync roots root-level only, with unlink behavior instead of normal folder deletion.
- Share import policy across manual upload, local sync, OneDrive, and future Google Drive.
- Separate app-unsupported, platform-unsupported, downloading, remote-only, and failed states.
- Keep download progress and folder health visible in grid/list UI.
- Make presentation priority downloads win over background sync downloads.
- Prepare source data for Recovery Center without adding a second error database.

## Acceptance Criteria

- Unsupported system/app files do not enter sync folders.
- Web-only platform limitations are shown as unsupported, not sync failure.
- Download progress updates in place.
- A present action on a remote item prioritizes that item.
- Local Sync remains Electron-only; OneDrive remains Electron and Web.

## Verification

```bash
npx vitest run src/renderer/src/lib/__tests__/media-import-policy.test.ts
npx vitest run src/renderer/src/lib/__tests__/sync-download-queue.test.ts
npx vitest run src/renderer/src/lib/__tests__/sync-folder-health.test.ts
npm run typecheck
npm run lint
```
