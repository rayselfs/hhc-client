# Media Sync Slice 4: LibrePresenter HHC LINE Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated LibrePresenter user add only their authorized HHC LINE collections through the existing folder picker and synchronize/project them in Electron and browser mode.

**Architecture:** Add one `hhc-line` implementation behind the existing read-only sync/cloud-provider boundaries. Reuse current folder picker, planner, queue, storage, offline policies, cleanup, and projection readiness. Account identity is stored on provider connections, while access tokens and content tickets remain memory-only. A live 403 cancels and purges only the affected account/root.

**Tech Stack:** TypeScript, React 19, HeroUI v3, IndexedDB/idb, Electron native storage path, Fetch/Range media, existing HHC auth adapter, Vitest, Playwright.

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/hhc-client-v2`
- Continue on a focused feature branch; preserve unrelated multimedia changes.
- Both Electron and browser mode are mandatory.
- Add `hhc-line` to the existing provider types; do not create a parallel sync subsystem.
- Reuse `CloudFolderPickerDialog` with single selection. Multiple groups are added by reopening it.
- Do not store HHC access/refresh tokens or content tickets in IndexedDB, localStorage, sessionStorage, file databases, logs, or diagnostics.
- Browser HHC LINE roots default to `online-only`; Electron roots default to `on-demand`.
- Browser offline caching is capped at 256 MiB and the existing 80% projected quota threshold.
- Browser online media does not become a source Blob merely to present it.
- Packaged Electron Asset requests use narrow main IPC, never permissive `Origin: null` CORS.
- Electron VLC playback always uses a native persistent or session-temp path.
- A 401 refreshes once; a second 401 ends the HHC session.
- A 403 cancels work and purges only the affected root/account.
- Network failures are retryable and never purge cached content.
- Do not add a second picker, auth SDK, provider registry framework, or new dependency.
- Dynamically import `hhc-line-connect.ts` from the adapter branch so the provider does not enter the
  signed-out/projection initial bundle.

---

## File Map

| File | Responsibility |
| --- | --- |
| `src/shared/types/folder.ts` | `hhc-line` provider type |
| `src/renderer/src/lib/sync-db.ts` | Account-scoped provider/root records and access-revoked state |
| `src/renderer/src/lib/sync-provider.ts` | Optional remote presentation source contract |
| `src/renderer/src/lib/hhc-asset-api.ts` | Environment-neutral Asset API contract/factory |
| `src/renderer/src/lib/hhc-asset-api-browser.ts` | Browser bearer/ticket REST client |
| `src/renderer/src/lib/hhc-asset-api-electron.ts` | Narrow preload client |
| `src/main/ipc/hhc-assets.ts` | Electron Asset requests and temp content leases |
| `src/main/ipc/native-fs.ts` | Existing `hhc-media` lease/path resolver |
| `src/shared/hhc-assets.ts` | Typed IPC request/response contracts |
| `src/renderer/src/lib/hhc-line-provider.ts` | Read-only provider mapping |
| `src/renderer/src/lib/hhc-line-connect.ts` | List/import/refresh operations |
| `src/renderer/src/lib/cloud-provider.ts` | Existing adapter dispatch |
| `src/renderer/src/lib/sync-runtime.ts` | Scheduled HHC refresh |
| `src/renderer/src/lib/sync-refresh.ts` | Existing snapshot/delta planner |
| `src/renderer/src/lib/sync-download-queue.ts` | Shared cancellation/commit guard from Slice 0 |
| `src/renderer/src/lib/sync-unlink.ts` | Root/account cleanup |
| `src/renderer/src/lib/presentation-readiness.ts` | Remote/native versus download-required readiness |
| `src/renderer/src/lib/media-projection-sync.ts` | Ticket lease renewal and authoritative replay |
| `src/renderer/src/components/Projection/FileProjection.tsx` | Source swap with playback-position restore |
| `src/renderer/src/components/Control/FileExplorer/CloudFolderPickerDialog.tsx` | Reused provider picker |
| `src/renderer/src/pages/FilesPage.tsx` | Add HHC LINE action and account-aware status |
| `electron.vite.config.ts` | Validated HHC Asset API origin build constant |
| `src/shared/app-config.ts` | Shared Asset API origin |

### Task 1: Make sync records account-scoped

**Files:**
- Modify: `src/shared/types/folder.ts`
- Modify: `src/renderer/src/lib/sync-db.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-db.test.ts`
- Modify: `src/renderer/src/lib/sync-unlink.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-unlink.test.ts`

**Types:**

~~~ts
export type SyncProviderType = 'local-fs' | 'onedrive' | 'hhc-line'

export interface ProviderConnectionRecord {
  id: string
  providerType: SyncProviderType
  displayName: string
  accountLabel?: string
  accountUserId?: string
  createdAt: number
  updatedAt: number
}

export interface FolderSyncLink {
  // existing fields remain
  status?: 'active' | 'access-revoked'
}
~~~

- [ ] **Step 1: Add failing database migration tests**

Increment `SYNC_DB_VERSION` and assert:

- existing OneDrive/local records migrate unchanged;
- HHC LINE records require `accountUserId`;
- HHC LINE connection IDs are deterministic from account user ID;
- listing by account returns no other account's records;
- imported HHC roots default `FolderSyncLink.status` to `active`.

- [ ] **Step 2: Add failing root/account cleanup tests**

Test two HHC accounts, multiple roots for A on one connection, a OneDrive root, and unrelated local
files. Purging A removes its connection and all A roots. Purging one A root leaves A's connection
and other roots intact. Both paths remove only their folders, items, blobs, thumbnails, derivatives,
cursors, preferences, and tombstones.

- [ ] **Step 3: Add the smallest schema extension**

Add a `by-account-user` index to provider connections and helper queries. Keep account fields
optional for existing providers. Store `access-revoked` on the affected root's existing
`FolderSyncLink` instead of connection state or a new health store.

- [ ] **Step 4: Route cleanup through existing unlink**

Extend `unlinkSyncRootFolderFromApp` / `unlinkSyncConnectionFromApp` with the Slice 0 queue cancellation call before resource cleanup. Add `unlinkHhcLineAccountFromApp(accountUserId)` that enumerates matching connections and reuses those functions.

- [ ] **Step 5: Validate and commit**

~~~bash
npx vitest run src/renderer/src/lib/__tests__/sync-db.test.ts src/renderer/src/lib/__tests__/sync-unlink.test.ts
npm run typecheck
git add src/shared/types/folder.ts src/renderer/src/lib/sync-db.ts src/renderer/src/lib/sync-unlink.ts src/renderer/src/lib/__tests__
git commit -m "feat: scope sync connections to HHC accounts"
~~~

### Task 2: Add the authenticated Asset API client and read-only provider

**Files:**
- Create: `src/renderer/src/lib/hhc-asset-api.ts`
- Create: `src/renderer/src/lib/hhc-asset-api-browser.ts`
- Create: `src/renderer/src/lib/hhc-asset-api-electron.ts`
- Create: `src/renderer/src/lib/hhc-line-provider.ts`
- Create: `src/renderer/src/lib/__tests__/hhc-asset-api.test.ts`
- Create: `src/main/ipc/hhc-assets.ts`
- Create: `src/main/__tests__/ipc/hhc-assets.test.ts`
- Create: `src/shared/hhc-assets.ts`
- Create: `src/renderer/src/lib/__tests__/hhc-line-provider.test.ts`
- Modify: `src/renderer/src/lib/sync-provider.ts`
- Modify: `electron.vite.config.ts`
- Modify: `src/shared/app-config.ts`
- Modify: `src/shared/build-constants.d.ts`
- Modify: `src/renderer/src/lib/onedrive-connect.ts`
- Modify: `src/renderer/src/lib/__tests__/onedrive-connect.test.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc/native-fs.ts`
- Modify: `src/main/__tests__/ipc/native-fs.test.ts`

**Remote source contract:**

~~~ts
export type SyncRemoteContentSource =
  | { kind: 'ticket'; url: string; expiresAt: number; etag: string }
  | { kind: 'native-lease'; url: string; leaseId: string; etag: string }

export interface ReadOnlySyncProvider {
  // existing methods remain
  getRemoteContentSource?(
    providerConnectionId: string,
    remoteItemId: string
  ): Promise<SyncRemoteContentSource>
}
~~~

Extend the existing `SyncChangePage` with optional `reset?: boolean`. The generic collector gathers
all reset pages before applying a full-scan plan.

Add `rootRemoteFolderId` to `SyncDownloadRequest` so provider errors and cancellation can target one
collection root without cancelling sibling roots on the same account connection. Update existing
OneDrive request construction without changing its behavior.

- [ ] **Step 1: Add REST client contract tests**

Cover list, reset snapshot, delta, metadata, ticket issue, and authenticated content download with
the request's `rootRemoteFolderId`. Assert:

- bearer access token comes from the in-memory `HhcAuthAdapter`;
- one 401 calls refresh/get-token once and retries once;
- a second 401 raises `auth-required`;
- 403 raises a distinct `access-revoked` error;
- 429/5xx/network are retryable;
- cursors and path IDs are URL encoded;
- ticket URL/query is absent from logging/error serialization.

Run the same contract against browser fetch and Electron IPC. Electron tests assert:

- renderer cannot supply a bearer token, user ID, role, arbitrary URL, or native target path;
- main uses the Slice 1 auth service's current access token;
- only fixed collection routes and validated opaque IDs are reachable;
- 401 refreshes once in main;
- packaged renderer makes no cross-origin Asset fetch.

- [ ] **Step 2: Add provider mapping tests**

Map collection ID to `remoteFolderId`, collection item ID to `remoteItemId`, revision cursor,
ETag/checksum, MIME/size, reset snapshots, tombstones, and 500-item pages into the extended
`SyncChangePage`. `downloadContent` writes through the existing storage path selected by the queue.

- [ ] **Step 3: Implement with existing fetch/auth primitives**

No SDK. The client accepts `getAccessToken(): Promise<string | null>` and
`refreshSession(): Promise<boolean>` from Slice 1. Add one `VITE_HHC_ASSET_ORIGIN` build input with
production default `https://www.alive.org.tw` through the existing validated build-constant /
`APP_CONFIG` path. Validate JSON at the boundary with narrow type guards rather than adding a schema
package.

`hhc-asset-api.ts` dynamically selects browser fetch or Electron preload. Register narrow
`hhc-assets` IPC in main and validate the sending window, operation, IDs, page cursor, Range options,
and response size. Main owns URL construction; preload exposes no generic fetch, token method, or
native path. Reuse the existing `hhc-media` protocol/native resolver for lease IDs.

- [ ] **Step 4: Implement read-only behavior**

`connect()` reads the current HHC session and creates/reuses one account connection.
`disconnect()` delegates account-scoped local cleanup only; it does not revoke server ACL.
`getRemoteContentSource()` returns an in-memory ticket and never persists it. Each collection remains
an existing `FolderSyncLink.remoteFolderId` with its own existing `sync-cursors` record.

- [ ] **Step 5: Validate and commit**

~~~bash
npx vitest run src/renderer/src/lib/__tests__/hhc-asset-api.test.ts src/renderer/src/lib/__tests__/hhc-line-provider.test.ts src/main/__tests__/ipc/hhc-assets.test.ts src/main/__tests__/ipc/native-fs.test.ts src/renderer/src/lib/__tests__/sync-provider.test.ts src/renderer/src/lib/__tests__/onedrive-connect.test.ts
npm run typecheck
git add src/renderer/src/lib/hhc-* src/renderer/src/lib/sync-provider.ts src/renderer/src/lib/onedrive-connect.ts src/main/ipc/hhc-assets.ts src/main/ipc/native-fs.ts src/main/__tests__/ipc/hhc-assets.test.ts src/main/__tests__/ipc/native-fs.test.ts src/main/index.ts src/shared/hhc-assets.ts src/shared/ipc-channels.ts src/preload electron.vite.config.ts src/shared/app-config.ts src/shared/build-constants.d.ts src/renderer/src/lib/__tests__
git commit -m "feat: add HHC LINE read-only provider"
~~~

### Task 3: Reuse the cloud picker and planner

**Files:**
- Create: `src/renderer/src/lib/hhc-line-connect.ts`
- Create: `src/renderer/src/lib/__tests__/hhc-line-connect.test.ts`
- Modify: `src/renderer/src/lib/cloud-provider.ts`
- Modify: `src/renderer/src/lib/__tests__/cloud-provider.test.ts`
- Modify: `src/renderer/src/lib/sync-refresh.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-refresh.test.ts`
- Modify: `src/renderer/src/components/Control/FileExplorer/CloudFolderPickerDialog.tsx`
- Create: `src/renderer/src/components/Control/FileExplorer/__tests__/HhcLineFolderPickerDialog.test.tsx`
- Modify: `src/renderer/src/pages/FilesPage.tsx`

- [ ] **Step 1: Add adapter and picker tests**

Assert the HHC adapter:

- lists only Asset API-authorized collections;
- presents them as top-level, non-navigable folders;
- keeps single selection;
- defaults browser import to `online-only` and Electron import to `on-demand`;
- permits multiple imports by reopening the same dialog;
- does not show collections already imported for the same account;
- never exposes another account's imported roots.

- [ ] **Step 2: Add planner mapping tests**

Feed full snapshot, delta, invalid-cursor reset, metadata update, tombstone, and unchanged cursor through the current `sync-refresh` functions. Assert existing reference-counted cleanup removes deleted assets.

- [ ] **Step 3: Add one explicit adapter branch**

Extend `CloudProviderId` to `'onedrive' | 'hhc-line'` and add one `HHC_LINE_ADAPTER` beside `ONEDRIVE_ADAPTER`. Its methods dynamically import `hhc-line-connect.ts` only when invoked. Do not build a registry/factory framework. Replace the OneDrive-only presentation dispatch with provider-type branches at the existing boundary.

- [ ] **Step 4: Reuse the dialog**

Pass provider label, root listing, selection, and import callbacks into `CloudFolderPickerDialog`. Preserve the current OneDrive tree behavior; HHC collections are a one-level list. Add only an HHC LINE entry/action in `FilesPage` when the current session has `media_sync_user`.

- [ ] **Step 5: Validate and commit**

~~~bash
npx vitest run src/renderer/src/lib/__tests__/hhc-line-connect.test.ts src/renderer/src/lib/__tests__/cloud-provider.test.ts src/renderer/src/lib/__tests__/sync-refresh.test.ts src/renderer/src/components/Control/FileExplorer/__tests__/HhcLineFolderPickerDialog.test.tsx
npm run typecheck
git add src/renderer/src/lib src/renderer/src/components/Control/FileExplorer src/renderer/src/pages/FilesPage.tsx
git commit -m "feat: import authorized HHC LINE folders"
~~~

### Task 4: Schedule HHC refresh through the existing runtime

**Files:**
- Modify: `src/renderer/src/lib/sync-runtime.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-runtime.test.ts`
- Modify: `src/renderer/src/lib/sync-folder-health.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-folder-health.test.ts`

- [ ] **Step 1: Add scheduler tests**

Test one refresh at a time per connection, idle interval, retryable backoff, auth-required stop, access-revoked purge trigger, offline recovery, runtime disposal, and no work when signed out/no HHC connections.

- [ ] **Step 2: Add HHC refresh beside OneDrive**

Enumerate active `hhc-line` connections and call `refreshFolder` through the cloud adapter. Use the current active/idle timing model and per-connection in-flight set; do not create a second timer framework.

- [ ] **Step 3: Surface root health**

Use root `FolderSyncLink.status` plus existing entry health. `access-revoked` is an error only until
cleanup completes and the root disappears. Do not show raw 401/403 bodies.

- [ ] **Step 4: Validate and commit**

~~~bash
npx vitest run src/renderer/src/lib/__tests__/sync-runtime.test.ts src/renderer/src/lib/__tests__/sync-folder-health.test.ts
npm run typecheck
git add src/renderer/src/lib/sync-runtime.ts src/renderer/src/lib/sync-folder-health.ts src/renderer/src/lib/__tests__
git commit -m "feat: refresh HHC LINE sync roots"
~~~

### Task 5: Support online tickets and bounded offline downloads

**Files:**
- Modify: `src/renderer/src/lib/presentation-readiness.ts`
- Modify: `src/renderer/src/lib/__tests__/presentation-readiness.test.ts`
- Modify: `src/renderer/src/lib/media-projection-sync.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-sync.test.ts`
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Modify: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`
- Modify: `src/renderer/src/lib/sync-download-storage.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-download-storage.test.ts`
- Modify: `src/main/ipc/hhc-assets.ts`
- Modify: `src/main/__tests__/ipc/hhc-assets.test.ts`
- Modify: `src/main/ipc/native-fs.ts`
- Modify: `src/main/__tests__/ipc/native-fs.test.ts`

- [ ] **Step 1: Add readiness tests for remote sources**

For `online-only` HHC items:

- browser-native image/audio/video/PDF/PPTX can prepare from a content ticket;
- Electron can prepare from an opaque main-process temp-file lease without a persisted sync blob;
- browser-unsupported media reports unsupported;
- Electron `desktop-engine` media queues on-demand download before VLC;
- local/offline items keep current behavior;
- the ticket value is not written back to `FileItemRecord` or sync DB.

- [ ] **Step 2: Add ticket renewal/resume tests**

In browser tests, use fake timers to prove the controlling window renews before expiry, publishes an
authoritative source update, and `FileProjection` restores video `currentTime`, paused/playing state,
volume, and playback rate after URL replacement. Renewal 403 invokes access-revoked cleanup; network
failure retries without purging.

- [ ] **Step 3: Resolve source at presentation time**

Keep persisted `FileItemRecord.url` as a provider placeholder. Add an async snapshot-preparation
path that asks the provider for a browser ticket or Electron temp lease only for the item being
presented. Store `url/lease ID`, `expiresAt` when applicable, provider connection, and remote item only in
the in-memory projection snapshot.

`media-projection-sync.ts` owns a renewal timer for the current remote entry and reuses the projection coordinator's authoritative replay. Stop the timer when content changes, projection closes, logout occurs, or the item becomes local.

Electron main writes online-only bytes to an opaque file under an app-owned temp directory, returns
only an opaque lease ID plus existing `hhc-media:` URL, and tracks the native path only in main.
Abort/delete the partial file on cancellation or authorization failure. Release the prior lease on
content change and clear all HHC leases on logout/account switch/app exit/startup recovery. Never
record a lease in sync DB or recent files.

- [ ] **Step 4: Keep VLC local**

If capability resolution chooses `vlc-embedded`, use the existing on-demand native path or the
online-only temp lease. Do not pass bearer/ticket URLs into libVLC in v1.

- [ ] **Step 5: Apply browser cache limits**

Before browser `on-demand`/`always-offline` download, reject files above 256 MiB or a projected `navigator.storage.estimate()` usage at/above 80%. Reuse `sync-download-storage` accounting. Electron continues its native storage policy.

- [ ] **Step 6: Validate and commit**

~~~bash
npx vitest run src/renderer/src/lib/__tests__/presentation-readiness.test.ts src/renderer/src/lib/__tests__/media-projection-sync.test.ts src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/renderer/src/lib/__tests__/sync-download-storage.test.ts src/main/__tests__/ipc/hhc-assets.test.ts src/main/__tests__/ipc/native-fs.test.ts
npm run typecheck
git add src/renderer/src/lib src/renderer/src/components/Projection src/main/ipc/hhc-assets.ts src/main/ipc/native-fs.ts src/main/__tests__/ipc/hhc-assets.test.ts src/main/__tests__/ipc/native-fs.test.ts
git commit -m "feat: present HHC media from expiring tickets"
~~~

### Task 6: Enforce auth, ACL, logout, and account-switch cleanup

**Files:**
- Create: `src/renderer/src/lib/hhc-line-access.ts`
- Create: `src/renderer/src/lib/__tests__/hhc-line-access.test.ts`
- Modify: `src/renderer/src/contexts/HhcAuthContext.tsx`
- Modify: `src/renderer/src/lib/hhc-line-connect.ts`
- Modify: `src/renderer/src/lib/sync-download-queue.ts`
- Modify: `src/renderer/src/lib/sync-unlink.ts`

- [ ] **Step 1: Add the access transition matrix**

Test list/delta/metadata/ticket/download 403; first/second 401; logout; account A to B switch; account A re-login; network error; and concurrent in-flight download plus revoke.

Assert account-level list 403 purges every HHC root for the current account, while
delta/metadata/ticket/download 403 purges only the addressed collection root.

- [ ] **Step 2: Centralize provider error handling**

`handleHhcLineAccessError(connectionId, remoteFolderId, error)` performs:

- retry token refresh once on 401;
- end session on the second 401;
- mark only that root access-revoked, enumerate its current entries through existing sync DB helpers,
  cancel their shared-queue jobs by `remoteItemId`, and call root cleanup on 403;
- classify network/5xx as retryable without cleanup.

Every HHC list/delta/metadata/ticket/download path calls this shared function.
The list path has no root ID and calls `unlinkHhcLineAccountFromApp(accountUserId)` on 403.

- [ ] **Step 3: Bind cleanup to session changes**

On logout, purge all `hhc-line` connections for the departing user. On account switch, complete A cleanup before listing/importing B. Never delete OneDrive, local, or another account's HHC data.

- [ ] **Step 4: Enforce the pre-commit guard**

Pass a connection/root authorization guard into the Slice 0 shared download queue/provider commit path. If cancellation, logout, or 403 occurs after bytes arrive but before storage commit, discard bytes/native temp file and do not mark available offline.

- [ ] **Step 5: Validate and commit**

~~~bash
npx vitest run src/renderer/src/lib/__tests__/hhc-line-access.test.ts src/renderer/src/lib/__tests__/sync-download-queue.test.ts src/renderer/src/lib/__tests__/sync-unlink.test.ts
npm run typecheck
git add src/renderer/src/lib/hhc-line-access.ts src/renderer/src/lib/sync-download-queue.ts src/renderer/src/lib/sync-unlink.ts src/renderer/src/contexts/HhcAuthContext.tsx src/renderer/src/lib/__tests__
git commit -m "fix: purge revoked HHC sync roots"
~~~

### Task 7: Close Electron/browser parity and UX

**Files:**
- Modify: `src/renderer/src/pages/FilesPage.tsx`
- Modify: `src/renderer/src/pages/__tests__/FilesPage.presentation-actions.test.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/CloudFolderPickerDialog.tsx`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/index.html`
- Modify: `.github/workflows/azure-static-web-apps-zealous-river-03bbb7100.yml`
- Modify: `.github/workflows/build-release.yml`
- Modify: `e2e/browser-projection.spec.ts`

- [ ] **Step 1: Add UX tests**

Test signed-out prompt, role-gated add action, no-authorized-folder empty state, single selection, imported state, access-revoked disappearance, manual refresh, offline policy change, retry status, and account switch.

- [ ] **Step 2: Add browser CSP only if tests prove it is required**

Allow only the production/test Asset API origin needed by `fetch`/media. Preserve `default-src` and do not add wildcards.

Set the client document referrer policy to `no-referrer` in `index.html` and add an E2E assertion
that a content-ticket query never appears in a subsequent request's `Referer` header.

Pass `VITE_HHC_ASSET_ORIGIN` from a non-secret GitHub environment variable in the Static Web Apps
and desktop build workflows.

- [ ] **Step 3: Run client gates**

~~~bash
npm run lint
npm run typecheck
npx vitest run
npm run build
npm run check:bundle
npm run test:e2e:browser
npm run check:desktop-native
~~~

- [ ] **Step 4: Run manual parity smoke**

Electron:

~~~bash
npm run dev
~~~

Use that emitted renderer development URL in both the Electron window and a normal browser
(currently `http://localhost:5173`); do not start a second raw Vite configuration that bypasses the
electron-vite aliases/plugins.

Verify login, picker, image/video/PDF/PPTX projection, on-demand VLC preparation, ticket renewal, popup projection, logout, account switch, and 403 cleanup.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer e2e scripts .github/workflows/azure-static-web-apps-zealous-river-03bbb7100.yml .github/workflows/build-release.yml
git commit -m "feat: finish HHC LINE sync experience"
~~~

## Slice Gate

- [ ] All focused and full client gates pass in Electron and browser modes.
- [ ] Browser online-only video uses Range requests and never writes a source Blob.
- [ ] No token/ticket is present in persisted databases or diagnostics.
- [ ] A cannot list, import, fetch, or retain B-only collections.
- [ ] Granting ACL makes a collection appear after refresh; revoking it cancels and purges the root.
- [ ] OneDrive and local sync regression tests remain green.
- [ ] Multiple authorized collections are imported by reopening the existing single-select dialog.

## Rollback

- Feature-gate the HHC LINE add action off before rolling back the client package.
- Existing local `hhc-line` roots are purged by the account-scoped cleanup path before downgrade.
- Server ACLs, bindings, and assets remain untouched by client rollback.
