# Admin LINE Media Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an Admin-managed LINE media library with safe browse, search, preview, rename, download, permanent-retention, deletion, and per-collection daily retention while preserving existing reader synchronization.

**Architecture:** Asset API remains the source of truth for collection items, revisions, tickets, deletion, and retention. `hhc-line-function-bot` remains the authenticated Admin management facade, API Gateway exposes only an exact allowlist, Admin Console supplies the online-only media UI, and hhc-client-v2 continues to consume the public changes contract. Physical Blob deletion stays in the existing lifecycle worker; the new scheduled worker only selects expired collection items and invokes the same domain deletion primitive as Admin.

**Tech Stack:** Go, PostgreSQL, Azure Container Apps Jobs/Bicep, TypeScript, React 19, HeroUI v3, Vite/Vitest, nginx, existing short-lived content-ticket streaming.

**Spec:** `docs/superpowers/specs/2026-08-18-admin-line-media-library-design.md`

## Global Constraints

- LINE groups are the only upload source; do not add Admin upload, paste, drag-and-drop, move, migration, nested folders, custom sorting, ZIP, trash, restore, or undo.
- All Admin media routes require the canonical Admin session and `media-sync:manage`; managers do not require the public reader role or a collection ACL.
- Managed responses expose only `id`, `displayName`, `mimeType`, `sizeBytes`, `createdAt`, and `retentionExempt`.
- Never expose or log Asset IDs, Blob keys, storage URLs, raw LINE identifiers, trust headers, filenames in retention logs, or ticket URLs.
- Retention defaults to 14 days, accepts only 1 through 365 days, is retroactive, and derives expiry from `createdAt`; do not persist per-item expiry.
- Batch selection, permanent-retention mutation, deletion, and content-ticket issuance accept at most 100 loaded items.
- Rename changes only the basename, keeps the extension immutable, allows duplicate display names, increments the collection content revision, and does not change Blob identity or ETag.
- Retention metadata does not advance the public reader revision; rename and deletion do.
- Manual and scheduled deletion use one transaction primitive and one tombstone revision per batch; physical Blob purge stays asynchronous in the existing lifecycle worker.
- Grid thumbnails use only browser-native rendering of original content through short-lived tickets; add no FFmpeg, derivative storage, search engine, PostgreSQL extension, or new package.
- Retention deploys in read-only preflight with mutation and schedule disabled; production enablement is a separate reviewed action after managers adjust policies and exemptions.

## Repository and Branch Map

| Repository | Root | Branch | Delivery |
| --- | --- | --- | --- |
| Asset API | `/Users/rayselfs/Projects/hhc/website/asset-api` | `feat/admin-line-media-library` from latest `origin/main` | B1 and B3 backend |
| LINE facade | `/Users/rayselfs/Projects/hhc/hhc-line-function-bot` | `feat/admin-line-media-library` from latest `origin/main` | B1 facade |
| API Gateway | `/Users/rayselfs/Projects/hhc/website/api-gateway` | `feat/admin-line-media-library` from latest `origin/main` | exact Admin routing |
| Admin Console | `/Users/rayselfs/Projects/hhc/website/admin-fe` | `feat/admin-line-media-library` from latest `origin/main` | B2 UI |
| hhc-client-v2 | `/Users/rayselfs/Projects/hhc/hhc-client-v2` | current `feat/media-projection` or a fresh agreed Plan B branch | B4 consumer regression |

Create isolated worktrees with `superpowers:using-git-worktrees` before implementation. Re-fetch `origin/main` in each repository and record its SHA in the PR description; do not implement against the discovery SHAs recorded during planning.

## Contract Map

```text
Admin MediaSyncPage
  -> /api/line/media-sync/collections/:collectionId/*
  -> hhc-line-function-bot authorize("media-sync:manage")
  -> /priv/assets/collections/:collectionId/*
  -> Asset API PostgreSQL transaction
  -> public /api/assets/content?ticket=... for GET/HEAD/Range

Asset retention job (03:00 Asia/Taipei)
  -> preview or select <= 100 expired active items
  -> same DeleteCollectionItems transaction
  -> tombstones + optional Asset deleted_at
  -> existing lifecycle worker purges Blob asynchronously
```

---

### Task 1: Add the Asset collection management schema

**Files:**
- Create: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/migrations/sql/013_admin_media_library.sql`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store_integration_test.go`

**Interfaces:**
- Produces `Collection.RetentionDays int`.
- Produces `CollectionItem.RetentionExempt bool`, `UpdatedRevision int64`, and `UpdatedAt time.Time`.
- Produces `ContentTicket.AccessMode string` with values `reader` or `manager`.

- [ ] **Step 1: Write failing migration and mapping tests**

Add integration assertions that a new collection receives `retentionDays == 14`, a new item receives `retentionExempt == false`, `updatedRevision == createdRevision`, and `updatedAt == createdAt`. Add direct SQL assertions that retention values `0` and `366` fail and that ticket `access_mode = 'other'` fails.

```go
if got.RetentionDays != 14 {
	 t.Fatalf("retention days = %d, want 14", got.RetentionDays)
}
if item.RetentionExempt || item.UpdatedRevision != item.CreatedRevision || !item.UpdatedAt.Equal(item.CreatedAt) {
	 t.Fatalf("unexpected item defaults: %+v", item)
}
```

- [ ] **Step 2: Run the focused tests and confirm the old schema fails**

Run: `go test ./internal/postgres -run 'TestCollectionManagementDefaults|TestCollectionManagementConstraints' -count=1`

Expected: FAIL because the columns and mapped fields do not exist.

- [ ] **Step 3: Add the minimal additive migration**

```sql
ALTER TABLE asset_collections
  ADD COLUMN retention_days smallint NOT NULL DEFAULT 14,
  ADD CONSTRAINT asset_collections_retention_days_check
    CHECK (retention_days BETWEEN 1 AND 365);

ALTER TABLE asset_collection_items
  ADD COLUMN retention_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_revision bigint,
  ADD COLUMN updated_at timestamptz;

UPDATE asset_collection_items
SET updated_revision = created_revision,
    updated_at = created_at
WHERE updated_revision IS NULL OR updated_at IS NULL;

ALTER TABLE asset_collection_items
  ALTER COLUMN updated_revision SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ADD CONSTRAINT asset_collection_items_updated_revision_check
    CHECK (updated_revision >= created_revision);

ALTER TABLE asset_content_tickets
  ADD COLUMN access_mode text NOT NULL DEFAULT 'reader',
  ADD CONSTRAINT asset_content_tickets_access_mode_check
    CHECK (access_mode IN ('reader', 'manager'));

CREATE INDEX asset_collection_items_managed_list_idx
  ON asset_collection_items (collection_id, created_at DESC, id DESC)
  WHERE deleted_revision IS NULL;

CREATE INDEX asset_collection_items_retention_idx
  ON asset_collection_items (created_at, id)
  WHERE deleted_revision IS NULL AND retention_exempt = false;
```

Update all collection, item, and ticket scans/inserts explicitly; do not use `SELECT *`.

- [ ] **Step 4: Run migration and repository tests**

Run: `go test ./internal/postgres -run 'TestCollectionManagementDefaults|TestCollectionManagementConstraints' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/migrations/sql/013_admin_media_library.sql internal/assets/types.go internal/postgres/store.go internal/postgres/store_integration_test.go
git commit -m "feat: add media collection management metadata"
```

### Task 2: Implement safe managed item listing, search, and retention settings

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store_integration_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler_test.go`

**Interfaces:**
- Produces `ListManagedCollectionItems(ctx, collectionID, query, cursor string, limit int) (ManagedCollectionItemPage, error)`.
- Produces `UpdateCollectionRetention(ctx, UpdateCollectionRetentionInput) (Collection, error)`.

```go
type ManagedCollectionItem struct {
	ID              string    `json:"id"`
	DisplayName     string    `json:"displayName"`
	MIMEType        string    `json:"mimeType"`
	SizeBytes       int64     `json:"sizeBytes"`
	CreatedAt       time.Time `json:"createdAt"`
	RetentionExempt bool      `json:"retentionExempt"`
}

type ManagedCollectionItemPage struct {
	Items   []ManagedCollectionItem `json:"items"`
	Cursor  string                  `json:"cursor,omitempty"`
	HasMore bool                    `json:"hasMore"`
}

type UpdateCollectionRetentionInput struct {
	CollectionID  string
	RetentionDays int
	CallerService string
	IdempotencyKey string
}
```

- [ ] **Step 1: Write failing service, repository, and HTTP tests**

Cover empty query, case-insensitive substring search, duplicate names, stable `(created_at DESC, id DESC)` cursor paging, malformed cursor, limit bounds, safe DTO serialization, 1/365 acceptance, 0/366 rejection, and unchanged collection revision after retention update.

```go
page, err := store.ListManagedCollectionItems(ctx, collectionID, "SUNday", "", 25)
if err != nil || len(page.Items) != 1 || page.Items[0].DisplayName != "Sunday.mp4" {
	 t.Fatalf("unexpected page: %+v, err=%v", page, err)
}
encoded, _ := json.Marshal(page)
for _, forbidden := range []string{"assetId", "blob", "remoteItemId", "ownerService"} {
	 if bytes.Contains(encoded, []byte(forbidden)) {
		 t.Fatalf("managed response contains %q", forbidden)
	 }
}
```

- [ ] **Step 2: Verify tests fail**

Run: `go test ./internal/assets ./internal/postgres ./internal/httpapi -run 'ManagedCollectionItems|CollectionRetention' -count=1`

Expected: FAIL because methods and routes are missing.

- [ ] **Step 3: Implement list/search and retention update**

Add exact internal routes:

```text
GET   /priv/assets/collections/{collectionID}/items?q=&cursor=&limit=
PATCH /priv/assets/collections/{collectionID}/retention
```

Use `ILIKE '%' || $query || '%'` with escaped query parameters, the existing opaque cursor encoding style, and a maximum page limit of 100. Update only `retention_days` and `updated_at`; do not increment the content revision.

- [ ] **Step 4: Run focused and package tests**

Run: `go test ./internal/assets ./internal/postgres ./internal/httpapi -run 'ManagedCollectionItems|CollectionRetention' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/assets/types.go internal/assets/service.go internal/postgres/store.go internal/httpapi/handler.go internal/assets/service_test.go internal/postgres/store_integration_test.go internal/httpapi/handler_test.go
git commit -m "feat: list and configure managed media collections"
```

### Task 3: Implement extension-locked rename and reader change upserts

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store_integration_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler_test.go`

**Interfaces:**
- Produces `RenameCollectionItem(ctx, RenameCollectionItemInput) (ManagedCollectionItem, error)`.
- Public change queries use `updated_revision` for upserts and continue to use `deleted_revision` for tombstones.

```go
type RenameCollectionItemInput struct {
	CollectionID   string
	ItemID         string
	DisplayName    string
	CallerService  string
	IdempotencyKey string
}
```

- [ ] **Step 1: Write failing rename tests**

Test trimmed basename acceptance, duplicate display names, slash/control-character rejection, 255-byte limit, extension-change rejection, missing/deleted item behavior, same-name idempotency, one revision increment, unchanged ETag/size/MIME/source revision/createdAt, and latest item emitted as an upsert.

```go
before := mustGetCollectionItem(t, store, collectionID, itemID)
renamed, err := service.RenameCollectionItem(ctx, assets.RenameCollectionItemInput{
	CollectionID: collectionID, ItemID: itemID, DisplayName: "renamed.mp4",
	CallerService: "hhc-line-function-bot", IdempotencyKey: "rename-1",
})
if err != nil || renamed.DisplayName != "renamed.mp4" {
	 t.Fatalf("rename failed: %+v, %v", renamed, err)
}
after := mustGetCollectionItem(t, store, collectionID, itemID)
if before.ETag != after.ETag || before.CreatedAt != after.CreatedAt {
	 t.Fatalf("rename changed content identity")
}
```

- [ ] **Step 2: Verify rename tests fail**

Run: `go test ./internal/assets ./internal/postgres ./internal/httpapi -run 'RenameCollectionItem|ItemUpdateRevision' -count=1`

Expected: FAIL because item rename and update revisions are absent.

- [ ] **Step 3: Implement one transaction**

Add:

```text
PATCH /priv/assets/collections/{collectionID}/items/{itemID}
```

Lock the collection and active item, validate the full proposed `displayName`, compare its extension case-insensitively with the stored extension, increment collection revision once, and update `display_name`, `updated_revision`, and `updated_at`. Make public delta upserts select items whose `updated_revision` is within the requested revision window. Reset pages continue to return the current active snapshot.

- [ ] **Step 4: Run focused tests**

Run: `go test ./internal/assets ./internal/postgres ./internal/httpapi -run 'RenameCollectionItem|ItemUpdateRevision' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/assets/types.go internal/assets/service.go internal/postgres/store.go internal/httpapi/handler.go internal/assets/service_test.go internal/postgres/store_integration_test.go internal/httpapi/handler_test.go
git commit -m "feat: rename collection items through change revisions"
```

### Task 4: Share batch permanent-retention and deletion transactions

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store_integration_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/lifecycle/worker_test.go`

**Interfaces:**
- Produces `SetCollectionItemsRetention(ctx, SetCollectionItemsRetentionInput) error`.
- Produces `DeleteCollectionItems(ctx, DeleteCollectionItemsInput) (DeleteCollectionItemsResult, error)`.
- Repository uses one private transaction helper for both Admin and worker deletion; no public generic rule engine.

```go
type SetCollectionItemsRetentionInput struct {
	CollectionID    string
	ItemIDs         []string
	RetentionExempt bool
	CallerService   string
	IdempotencyKey  string
}

type DeleteCollectionItemsInput struct {
	CollectionID   string
	ItemIDs        []string
	CallerService  string
	IdempotencyKey string
}

type DeleteCollectionItemsResult struct {
	Deleted        int `json:"deleted"`
	AlreadyRemoved int `json:"alreadyRemoved"`
}
```

- [ ] **Step 1: Write failing batch and race tests**

Cover 0/101 selection rejection, duplicate ID normalization, active/deleted mixtures, replayed idempotency keys, one revision per active batch, one tombstone per deleted item, explicit delete ignoring `retentionExempt`, exemption winning when committed before worker lock, deletion winning before later rename, and ticket invalidation after deletion.

Also cover Asset deletion only when all conditions are true:

```text
namespace = line.group.media-sync
owner_service = hhc-line-function-bot
owner_type = media_sync_ingest
no active collection item references the Asset
```

Any remaining active reference must preserve the Asset.

- [ ] **Step 2: Verify focused tests fail**

Run: `go test ./internal/postgres ./internal/httpapi ./internal/lifecycle -run 'BatchRetention|BatchDelete|ReferencedAsset|DeleteRace' -count=1`

Expected: FAIL because batch primitives do not exist and single-item deletion does not hand unreferenced ingest Assets to lifecycle purge.

- [ ] **Step 3: Implement the two mutations and shared private helper**

Add exact internal routes:

```text
POST /priv/assets/collections/{collectionID}/items/retention
POST /priv/assets/collections/{collectionID}/items/delete
```

Normalize and validate 1 through 100 UUIDs before the transaction. Lock the collection first, then active item rows in stable ID order. Permanent-retention updates only `retention_exempt` and `updated_at`. Deletion increments revision once only when at least one active item is deleted, stamps every tombstone with that revision, and updates eligible unreferenced Assets to the existing lifecycle-deleted state.

- [ ] **Step 4: Run focused tests**

Run: `go test ./internal/postgres ./internal/httpapi ./internal/lifecycle -run 'BatchRetention|BatchDelete|ReferencedAsset|DeleteRace' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/assets/types.go internal/assets/service.go internal/postgres/store.go internal/httpapi/handler.go internal/postgres/store_integration_test.go internal/httpapi/handler_test.go internal/lifecycle/worker_test.go
git commit -m "feat: manage permanent and deleted collection items"
```

### Task 5: Issue manager-scoped content tickets and current download names

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store_integration_test.go`
- Test: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler_test.go`

**Interfaces:**
- Produces `IssueManagedContentTickets(ctx, collectionID string, itemIDs []string, ttl time.Duration) (ManagedContentTicketBatch, error)`.

```go
type ManagedContentTicket struct {
	ItemID     string    `json:"itemId"`
	ContentURL string    `json:"contentUrl"`
	ExpiresAt  time.Time `json:"expiresAt"`
	ETag       string    `json:"etag"`
}

type ManagedContentTicketBatch struct {
	Tickets            []ManagedContentTicket `json:"tickets"`
	UnavailableItemIDs []string               `json:"unavailableItemIds"`
}
```

- [ ] **Step 1: Write failing ticket and streaming tests**

Cover 1 and 100 item batches, 101 rejection, manager tickets without reader role/ACL, reader ticket behavior unchanged, five-minute maximum TTL, active item/Asset/ETag recheck, immediate invalidation after deletion, latest `displayName` in `Content-Disposition`, GET, HEAD, Range, ETag, conditional request, `private, no-store`, and no-referrer behavior.

```go
resp := redeemTicket(t, ticket.ContentURL, http.MethodHead, nil)
if resp.StatusCode != http.StatusOK || resp.Header.Get("Accept-Ranges") != "bytes" {
	 t.Fatalf("unexpected HEAD response: %d %v", resp.StatusCode, resp.Header)
}
if !strings.Contains(resp.Header.Get("Content-Disposition"), "renamed.mp4") {
	 t.Fatalf("download did not use current display name")
}
```

- [ ] **Step 2: Verify tests fail**

Run: `go test ./internal/assets ./internal/postgres ./internal/httpapi -run 'ManagedContentTicket|ContentDisposition|TicketDeletionInvalidation' -count=1`

Expected: FAIL because tickets only support the reader authorization path and download metadata uses the Asset filename.

- [ ] **Step 3: Implement manager ticket issuance**

Add:

```text
POST /priv/assets/collections/{collectionID}/items/content-tickets
```

Store `access_mode = 'manager'`; manager issuance trusts only the internal service boundary and active collection item, not reader roles or ACLs. Redemption branches on the stored access mode, rechecks the exact active item and ETag, and uses the current collection item display name. Return only relative `/api/assets/content?ticket=...` URLs.

- [ ] **Step 4: Run focused and full Asset API tests**

Run: `go test ./internal/assets ./internal/postgres ./internal/httpapi -run 'ManagedContentTicket|ContentDisposition|TicketDeletionInvalidation' -count=1`

Expected: PASS.

Run: `go test -race ./... -count=1 -p=1`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/assets/types.go internal/assets/service.go internal/postgres/store.go internal/httpapi/handler.go internal/assets/service_test.go internal/postgres/store_integration_test.go internal/httpapi/handler_test.go
git commit -m "feat: issue manager media content tickets"
```

### Task 6: Extend the LINE management facade without exposing Asset internals

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/hhc-line-function-bot/src/clients/asset-api.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-line-function-bot/src/media-sync/service.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-line-function-bot/src/media-sync/http-routes.ts`
- Test: `/Users/rayselfs/Projects/hhc/hhc-line-function-bot/src/__tests__/asset-api.test.ts`
- Test: `/Users/rayselfs/Projects/hhc/hhc-line-function-bot/src/__tests__/media-sync-http.test.ts`

**Interfaces:**
- Consumes the Task 2 through Task 5 Asset private endpoints and safe DTOs.
- Produces Admin routes under `/api/line/media-sync/collections/:collectionId` with the same JSON field names.

- [ ] **Step 1: Write failing client parser tests**

Use exact safe shapes and reject extra or malformed management payloads at the facade boundary.

```ts
expect(parseManagedCollectionItem({
  id: itemId,
  displayName: 'Sunday.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 1200,
  createdAt: '2026-08-18T06:30:00.000Z',
  retentionExempt: false
})).toEqual({
  id: itemId,
  displayName: 'Sunday.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 1200,
  createdAt: '2026-08-18T06:30:00.000Z',
  retentionExempt: false
})
```

- [ ] **Step 2: Write failing route authorization and validation tests**

Assert every route denies missing `media-sync:manage`, does not accept reader ACL as a substitute, maps Asset 403 without revealing existence, validates retention and 1..100 IDs, requires `Idempotency-Key` for rename/retention/delete, and does not require it for ticket issuance.

- [ ] **Step 3: Verify tests fail**

Run: `pnpm vitest run src/__tests__/asset-api.test.ts src/__tests__/media-sync-http.test.ts`

Expected: FAIL because management client methods and routes are absent.

- [ ] **Step 4: Implement the minimal typed facade**

Add routes:

```text
GET   /api/line/media-sync/collections/:collectionId/items
PATCH /api/line/media-sync/collections/:collectionId/retention
PATCH /api/line/media-sync/collections/:collectionId/items/:itemId
POST  /api/line/media-sync/collections/:collectionId/items/retention
POST  /api/line/media-sync/collections/:collectionId/items/delete
POST  /api/line/media-sync/collections/:collectionId/items/content-tickets
```

Reuse the existing authorization, strict JSON-body reader, session error mapping, and internal Asset client. Do not introduce a second route framework or expose internal response fields.

- [ ] **Step 5: Run tests, lint, and build**

Run: `pnpm vitest run src/__tests__/asset-api.test.ts src/__tests__/media-sync-http.test.ts`

Expected: PASS.

Run: `pnpm lint && pnpm build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/clients/asset-api.ts src/media-sync/service.ts src/media-sync/http-routes.ts src/__tests__/asset-api.test.ts src/__tests__/media-sync-http.test.ts
git commit -m "feat: expose managed LINE media operations"
```

### Task 7: Add exact Gateway management and ticket-streaming routes

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/website/api-gateway/conf.d/default.conf`
- Modify: `/Users/rayselfs/Projects/hhc/website/api-gateway/scripts/test-media-sync-routing.sh`
- Modify: `/Users/rayselfs/Projects/hhc/website/api-gateway/scripts/runtime-smoke.sh`

**Interfaces:**
- Consumes the Task 6 Admin facade paths.
- Produces same-origin Admin access to `/api/assets/content?ticket=...` with no Admin bearer, cookie, or trusted identity forwarding.

- [ ] **Step 1: Extend the static routing test first**

Assert the Admin host allowlist contains only the six collection media path shapes from Task 6 and that another `/api/line/media-sync/` path is rejected. Assert the exact content location:

```nginx
location = /api/assets/content {
    include /etc/nginx/snippets/streaming.conf;
    proxy_pass_request_headers off;
    proxy_set_header Range $http_range;
    proxy_set_header If-Range $http_if_range;
    proxy_set_header If-None-Match $http_if_none_match;
    proxy_set_header If-Modified-Since $http_if_modified_since;
    proxy_pass http://asset_api;
}
```

The final header list must match the existing public ticket-content route exactly; copy it rather than inventing another list.

- [ ] **Step 2: Verify the routing test fails**

Run: `./scripts/test-media-sync-routing.sh`

Expected: FAIL because the new exact paths and Admin content-ticket location are missing.

- [ ] **Step 3: Implement the narrow nginx allowlist**

Extend the existing Admin media-sync regex only for the approved item/list/retention routes. Add the exact `/api/assets/content` Admin location, preserve GET/HEAD/Range/conditional headers, and explicitly suppress `Authorization`, cookies, and trusted identity headers by retaining `proxy_pass_request_headers off` plus the copied safe header allowlist.

- [ ] **Step 4: Run static and container routing checks**

Run: `./scripts/test-media-sync-routing.sh`

Expected: PASS.

Run: `go test ./... && go vet ./... && docker build --build-arg "RELEASE=plan-b-verify" -t api-gateway:plan-b . && ./scripts/test-media-sync-routing.sh api-gateway:plan-b`

Expected: PASS; nginx config is valid, approved requests route, unapproved siblings are rejected, and the container has the exact ticket-header allowlist. Production GET/HEAD/Range remains a Task 13 smoke check because it requires deployed upstreams.

- [ ] **Step 5: Commit**

```bash
git add conf.d/default.conf scripts/test-media-sync-routing.sh scripts/runtime-smoke.sh
git commit -m "feat: route Admin media management and content tickets"
```

### Task 8: Add the Admin API client and deterministic selection model

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/lib/media-sync-api.ts`
- Create: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/lib/media-selection.ts`
- Create: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/lib/media-selection.test.ts`
- Test: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/lib/media-sync-api.test.ts`

**Interfaces:**
- Produces `ManagedMediaItem`, `ManagedMediaPage`, `ManagedContentTicket`, and facade client methods.
- Produces `selectMediaItem(state, orderedIds, itemId, modifiers, max)` for all four view modes.

```ts
export type MediaSelectionState = {
  selectedIds: Set<string>
  anchorId?: string
}

export function selectMediaItem(
  state: MediaSelectionState,
  orderedIds: readonly string[],
  itemId: string,
  modifiers: { toggle: boolean; range: boolean },
  max = 100
): MediaSelectionState
```

- [ ] **Step 1: Write selection tests**

Cover plain click, Ctrl/Cmd toggle through the shared `toggle` flag, loaded-only Shift range, anchor updates, selection preservation across appended IDs, and deterministic truncation at 100.

```ts
it('selects only the loaded range and caps it at 100', () => {
  const ids = Array.from({ length: 120 }, (_, index) => `item-${index}`)
  const start = selectMediaItem({ selectedIds: new Set() }, ids, 'item-0', { toggle: false, range: false })
  const range = selectMediaItem(start, ids, 'item-119', { toggle: false, range: true })
  expect([...range.selectedIds]).toHaveLength(100)
  expect(range.selectedIds.has('item-100')).toBe(false)
})
```

- [ ] **Step 2: Write API client tests**

Assert query/cursor URL encoding, CSRF on mutations, one session refresh on 401, safe response parsing, ticket URLs kept only in returned values, and exact mutation bodies.

- [ ] **Step 3: Verify tests fail**

Run: `pnpm test:run -- src/lib/media-selection.test.ts src/lib/media-sync-api.test.ts`

Expected: FAIL because the helper and API methods do not exist.

- [ ] **Step 4: Implement pure selection and reuse the existing request helper**

Do not add a selection store. Keep selection in the library component, use the pure helper for click and keyboard behavior, and extend the existing API module with:

```ts
listCollectionItems(collectionId, { query, cursor, limit, signal })
updateCollectionRetention(collectionId, retentionDays)
renameCollectionItem(collectionId, itemId, displayName)
setCollectionItemsRetention(collectionId, itemIds, retentionExempt)
deleteCollectionItems(collectionId, itemIds)
issueCollectionItemTickets(collectionId, itemIds)
```

- [ ] **Step 5: Run tests and commit**

Run: `pnpm test:run -- src/lib/media-selection.test.ts src/lib/media-sync-api.test.ts`

Expected: PASS.

```bash
git add src/lib/media-sync-api.ts src/lib/media-sync-api.test.ts src/lib/media-selection.ts src/lib/media-selection.test.ts
git commit -m "feat: add Admin media API and selection model"
```

### Task 9: Build browse, search, four views, thumbnails, and viewer

**Files:**
- Create: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/media-sync/MediaLibrarySection.tsx`
- Create: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/media-sync/MediaLibrarySection.test.tsx`
- Create: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/media-sync/MediaViewer.tsx`
- Create: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/media-sync/MediaViewer.test.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/MediaSyncPage.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/index.css`

**Interfaces:**
- Consumes Task 8 API and selection helper.
- Produces one collection-scoped online library embedded below existing folder settings.

- [ ] **Step 1: Write failing browsing and interaction tests**

Cover default medium view, list/small/medium/large switching with preserved selection, browser-local key `hhc-admin-media-view-mode`, plain/Ctrl/Cmd/Shift click, Space toggle, Enter and double-click viewer open, accessible explicit preview action, empty-space clear, cursor load-more, 100 cap, and `建立時間` display.

Use fake timers to prove search waits 250 ms, sends the current server query, aborts the previous request, and preserves the current list/selection on 429, 5xx, or network failure.

- [ ] **Step 2: Write failing thumbnail and viewer tests**

Cover no ticket request before intersection, image lazy load, video metadata-only static frame with no controls/focus/pointer interaction, forced pause on play, icon fallback on ticket/decode/seek failure, viewer image/video/audio/PDF/unsupported states, and cleanup that pauses media and discards the ticket state on close.

```ts
expect(screen.getByTestId('grid-video')).toHaveAttribute('preload', 'metadata')
expect(screen.getByTestId('grid-video')).not.toHaveAttribute('controls')
expect(screen.getByTestId('grid-video')).toHaveAttribute('tabindex', '-1')
```

- [ ] **Step 3: Verify tests fail**

Run: `pnpm test:run -- src/pages/media-sync/MediaLibrarySection.test.tsx src/pages/media-sync/MediaViewer.test.tsx`

Expected: FAIL because the media library components are missing.

- [ ] **Step 4: Implement the minimal components**

Keep server results, cursor, selection, focused ID, and dialog state local to `MediaLibrarySection`. Use one `IntersectionObserver`, request item-scoped tickets only for visible supported cards, `<img loading="lazy">`, and a paused `<video preload="metadata">` that seeks once to a static frame. Use existing HeroUI modal/button/input primitives and lucide icons; add no dependency.

The viewer requests a fresh ticket on open. Render image, controlled video, controlled audio, browser-native PDF embed with download fallback, or metadata plus download for unsupported types. On close, pause any media element, clear `src`, and remove ticket state.

- [ ] **Step 5: Run component and page regressions**

Run: `pnpm test:run -- src/pages/media-sync/MediaLibrarySection.test.tsx src/pages/media-sync/MediaViewer.test.tsx src/pages/MediaSyncPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/media-sync/MediaLibrarySection.tsx src/pages/media-sync/MediaLibrarySection.test.tsx src/pages/media-sync/MediaViewer.tsx src/pages/media-sync/MediaViewer.test.tsx src/pages/MediaSyncPage.tsx src/index.css
git commit -m "feat: browse and preview managed LINE media"
```

### Task 10: Add retention, rename, permanent, delete, and download actions to Admin

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/media-sync/MediaLibrarySection.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/media-sync/MediaLibrarySection.test.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/MediaSyncPage.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/pages/MediaSyncPage.test.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/website/admin-fe/src/preferences/locale-context.tsx`

**Interfaces:**
- Consumes all Task 8 mutation methods.
- Produces complete B2 manager workflow with existing Admin toast, dialog, and locale patterns.

- [ ] **Step 1: Write failing retention-setting tests**

Cover numeric 1/365 acceptance, 0/366 client rejection, default 14 rendering, reduction warning with irreversible next-run copy, saved value refresh, and no per-item expiry label.

- [ ] **Step 2: Write failing rename and permanent-retention tests**

Cover basename-only input, visible immutable extension, trimmed name, server validation display, duplicate name acceptance, single-item rename, batch set/clear permanent, retained selection after success, and 404 refresh/removal behavior.

- [ ] **Step 3: Write failing delete and download tests**

Cover explicit irreversible delete confirmation, single/batch deletion, permanent item still deletable, partial already-removed success, one download, up to 100 separate anchor-triggered downloads within the user action, no ZIP, partial ticket failures, and browser multiple-download permission guidance with started/failed counts.

- [ ] **Step 4: Verify tests fail**

Run: `pnpm test:run -- src/pages/media-sync/MediaLibrarySection.test.tsx src/pages/MediaSyncPage.test.tsx`

Expected: FAIL because the management actions and copy are absent.

- [ ] **Step 5: Implement actions with existing Admin primitives**

Keep optimistic behavior conservative: wait for mutation success, then update or remove returned items; on 429/5xx/network preserve list and selection and show retry. On 404 remove unavailable items and refresh the current query. Trigger downloads from the explicit click handler using temporary anchors and current ticket URLs; never persist them or add ZIP fallback.

Add message keys to every locale already supported by `locale-context.tsx`, including these Traditional Chinese labels:

```text
mediaLibrary = 媒體檔案
createdAt = 建立時間
retentionDays = 保留天數
retentionReductionWarning = 已超過新保留期限的檔案，將在下一次排程永久刪除；永久保留的檔案不受影響。
keepPermanently = 永久保留
removePermanentRetention = 取消永久保留
rename = 重新命名
deletePermanently = 永久刪除
deleteIrreversible = 刪除後無法復原。
allowMultipleDownloads = 瀏覽器可能封鎖多檔下載，請允許本站下載多個檔案後重試。
```

Use clear localized equivalents, not untranslated keys, for English, Simplified Chinese, Japanese, and Korean.

- [ ] **Step 6: Run Admin verification**

Run: `pnpm test:run`

Expected: PASS.

Run: `pnpm lint && pnpm build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/media-sync/MediaLibrarySection.tsx src/pages/media-sync/MediaLibrarySection.test.tsx src/pages/MediaSyncPage.tsx src/pages/MediaSyncPage.test.tsx src/preferences/locale-context.tsx
git commit -m "feat: manage LINE media retention and files"
```

### Task 11: Add a bounded Asset retention worker in disabled preflight mode

**Files:**
- Create: `/Users/rayselfs/Projects/hhc/website/asset-api/cmd/retention-worker/main.go`
- Create: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/retention/worker.go`
- Create: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/retention/worker_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/postgres/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/internal/httpapi/handler.go`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/Dockerfile`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/infra/main.bicep`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/.github/workflows/release.yml`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/scripts/check-what-if.sh`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/scripts/test-release-workflow.sh`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/scripts/test-what-if-policy.sh`
- Modify: `/Users/rayselfs/Projects/hhc/website/asset-api/infra/README.md`

**Interfaces:**
- Consumes Task 4 shared deletion primitive.
- Produces `SweepExpiredCollectionItems(ctx, now, batchSize)` with batch size fixed at 100.
- Produces read-only preview aggregates by opaque collection ID: candidate count and total bytes.
- Extends existing `GET /priv/assets/operations` with `expiredCollectionItems`; existing `purgePending` remains the Blob-purge backlog source.

- [ ] **Step 1: Write failing exact-boundary and preflight tests**

Use a fixed UTC clock and cover `createdAt + retentionDays*24h == now` as expired, one nanosecond before as active, retroactive policy changes, exempt skip, already removed skip, max-100 batches, retry idempotency, and dry-run zero writes.

```go
now := time.Date(2026, 8, 19, 19, 0, 0, 0, time.UTC)
result, err := worker.SweepExpiredCollectionItems(ctx, now, 100)
if err != nil || result.Scanned != 100 || result.Deleted != 0 {
	 t.Fatalf("unexpected preflight: %+v, %v", result, err)
}
```

- [ ] **Step 2: Verify worker tests fail**

Run: `go test ./internal/retention -count=1`

Expected: FAIL because the worker package is missing.

- [ ] **Step 3: Implement the small job runner**

Use the existing PostgreSQL configuration and logger. `ASSET_RETENTION_APPLY_ENABLED=false` is the default and logs only run ID, opaque collection ID, counts, total bytes, duration, backlog, and failures. When true, repeatedly fetch at most 100 candidates, invoke Task 4 deletion, and stop when no candidates remain. Do not create a rules table, plugin interface, or scheduler library.

Extend the existing operations query with a derived count named `expiredCollectionItems`. Use these existing native observability sources instead of adding a metrics dependency or run-history table:

```text
last successful retention run timestamp -> Azure Container Apps Job execution history
expired candidate backlog               -> GET /priv/assets/operations.expiredCollectionItems
deleted item count                       -> final structured retention run log
failed batch count                       -> final structured retention run log and failed job status
Blob purge backlog                       -> GET /priv/assets/operations.purgePending
Blob purge failures                      -> existing lifecycle worker error logs
```

The final run log must include `runId`, `applyEnabled`, `startedAt`, `completedAt`, `durationMs`, `scanned`, `deleted`, `exemptSkipped`, `alreadyRemoved`, `failedItems`, `failedBatches`, and `remainingBacklog`, without content identifiers.

- [ ] **Step 4: Add executable and deployment wiring with activation off**

Build `/asset-retention-worker` in the existing Dockerfile. Add Bicep parameters:

```bicep
param deployRetentionJob bool = false
param retentionApplyEnabled bool = false
```

Add an Azure Container Apps Job using the existing runtime identity and DB secret, command `/asset-retention-worker`, environment `ASSET_RETENTION_APPLY_ENABLED`, and cron `0 19 * * *` because ACA schedules use UTC and 19:00 UTC is 03:00 Asia/Taipei. Initial release inputs must keep `deployRetentionJob=false` and `retentionApplyEnabled=false`.

- [ ] **Step 5: Test job, image, Bicep, and release safety**

Run: `go test ./internal/retention ./internal/postgres ./internal/httpapi -run 'Retention|Expired|Operations' -count=1`

Expected: PASS.

Run: `./scripts/test-release-workflow.sh && ./scripts/test-what-if-policy.sh`

Expected: PASS and assertions prove both deployment and mutation are disabled by default.

Run: `az bicep build --file infra/main.bicep --stdout >/dev/null`

Expected: valid Bicep; what-if policy permits only the bounded scheduled job addition/change.

- [ ] **Step 6: Run full Asset verification and commit**

Run: `go test -race ./... -count=1 -p=1`

Expected: PASS.

```bash
git add cmd/retention-worker/main.go internal/retention/worker.go internal/retention/worker_test.go internal/postgres/store.go internal/assets/types.go internal/assets/service.go internal/httpapi/handler.go Dockerfile infra/main.bicep .github/workflows/release.yml scripts/check-what-if.sh scripts/test-release-workflow.sh scripts/test-what-if-policy.sh infra/README.md
git commit -m "feat: add disabled media retention preflight job"
```

### Task 12: Prove hhc-client-v2 rename and deletion reconciliation

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/hhc-client-v2/src/shared/hhc-assets.ts`
- Modify only if tests require it: `/Users/rayselfs/Projects/hhc/hhc-client-v2/src/renderer/src/lib/hhc-line-provider.ts`
- Modify only if tests require it: `/Users/rayselfs/Projects/hhc/hhc-client-v2/src/renderer/src/lib/sync-refresh.ts`
- Test: `/Users/rayselfs/Projects/hhc/hhc-client-v2/src/renderer/src/lib/__tests__/hhc-line-provider.test.ts`
- Test: `/Users/rayselfs/Projects/hhc/hhc-client-v2/src/renderer/src/lib/__tests__/sync-refresh.test.ts`

**Interfaces:**
- Consumes public Asset changes containing `updatedRevision` and `updatedAt` while retaining the same item ID, ETag, size, MIME type, and source revision on rename.
- Produces no Admin or retention metadata in client state.

- [ ] **Step 1: Write failing rename-without-redownload test**

Start with a locally downloaded item and Blob, apply an upsert for the same remote item/ETag with a new `displayName`, and assert the visible name changes while the Blob reference and content-fetch mock remain untouched.

```ts
expect(updated.name).toBe('renamed.mp4')
expect(updated.blob).toBe(existingBlob)
expect(fetchContent).not.toHaveBeenCalled()
```

- [ ] **Step 2: Write tombstone and reset tests**

Cover identical manual/scheduled tombstones removing local content and the existing long-offline reset barrier removing an item absent from the current active snapshot.

- [ ] **Step 3: Verify the focused tests**

Run: `npx vitest run src/renderer/src/lib/__tests__/hhc-line-provider.test.ts src/renderer/src/lib/__tests__/sync-refresh.test.ts`

Expected: rename test may fail if the public type or refresh comparison omits update revisions; deletion/reset tests establish the current baseline.

- [ ] **Step 4: Make only the compatibility change the failing test requires**

Add `updatedRevision` and `updatedAt` to the shared public contract. Preserve the existing content Blob whenever item ID and content identity are unchanged; do not add Admin fields, a new store, or a separate rename path.

- [ ] **Step 5: Run client verification**

Run: `npx vitest run src/renderer/src/lib/__tests__/hhc-line-provider.test.ts src/renderer/src/lib/__tests__/sync-refresh.test.ts`

Expected: PASS.

Run: `npm run typecheck && npm run lint && npm run build`

Expected: PASS in the existing Electron/browser dual-mode build.

- [ ] **Step 6: Commit**

```bash
git add src/shared/hhc-assets.ts src/renderer/src/lib/hhc-line-provider.ts src/renderer/src/lib/sync-refresh.ts src/renderer/src/lib/__tests__/hhc-line-provider.test.ts src/renderer/src/lib/__tests__/sync-refresh.test.ts
git commit -m "test: preserve media blobs across remote rename"
```

Before committing, omit unchanged production files from `git add`.

### Task 13: Integrate, release in dependency order, and activate retention separately

**Files:**
- Modify only if contract evidence requires it: the five repository PR descriptions and existing release runbooks.
- Do not change runtime configuration outside reviewed PRs and the approved activation action.

**Interfaces:**
- Consumes Tasks 1 through 12.
- Produces verified production B1 through B4 and a separately approved B3 activation.

- [ ] **Step 1: Run repository-wide gates on fresh branch heads**

```text
asset-api: go test -race ./... -count=1 -p=1; migration test; Bicep/release safety scripts
hhc-line-function-bot: pnpm test; pnpm lint; pnpm build
api-gateway: static routing test; nginx config test; runtime smoke
admin-fe: pnpm test:run; pnpm lint; pnpm build
hhc-client-v2: npm run typecheck; npm run lint; npx vitest run; npm run build
```

Every command must exit 0 on the exact commit pushed to its PR.

- [ ] **Step 2: Review each PR against the approved spec**

Verify safe DTOs, authorization independence, exact Gateway routes, no new dependency, no thumbnail generation, no ZIP, no upload/move/trash, no ticket persistence, and no retention activation. Resolve all Critical and Important findings before merge.

- [ ] **Step 3: Merge and deploy the non-destructive dependency chain**

Merge only after CI success in this order:

```text
1. asset-api schema + B1 API + retention executable with job disabled
2. hhc-line-function-bot facade
3. api-gateway exact routes
4. admin-fe library
5. hhc-client-v2 compatibility release
```

After each deployment, smoke its new boundary before continuing. Roll back the current layer on contract, authorization, routing, or streaming failure.

- [ ] **Step 4: Run production B1/B2/B4 smoke checks with a disposable test item**

As an authorized manager, verify list/search, all four views, image/video fallback, image/video/audio/PDF viewer, one and multiple download, rename, set/clear permanent, explicit delete, `建立時間`, 1/365 retention settings, 0/366 rejection, reader upsert, client rename without redownload, tombstone removal, GET/HEAD/Range/ETag/no-store, and denial without `media-sync:manage`.

Do not use a production file required by users for deletion checks.

- [ ] **Step 5: Deploy preflight only and record the approval evidence**

Enable job deployment while retaining `ASSET_RETENTION_APPLY_ENABLED=false`. Execute once manually or wait for the scheduled preflight. Record per-collection opaque ID, candidate count, total bytes, aggregate backlog, duration, and zero mutations. Confirm logs contain no names, LINE IDs, Blob keys, or ticket URLs.

- [ ] **Step 6: Let managers adjust policy and permanent items**

Provide the preflight counts through the approved operational channel. Managers update `retentionDays` and mark required items `永久保留`. Run preflight again and compare counts/bytes with the approved expectation.

- [ ] **Step 7: Request explicit approval for destructive activation**

Present the exact configuration diff changing only `retentionApplyEnabled` from `false` to `true`, the approved preflight totals, rollback value `false`, and the next scheduled run time. Do not activate without explicit approval.

- [ ] **Step 8: Activate and verify the first retention run**

After approval and CI, enable apply mode. Verify run ID, scanned/deleted/exempt-skipped/already-removed/failed counts, duration, candidate backlog, tombstone revisions, ticket invalidation, client delta and reset reconciliation, Asset lifecycle state, Blob purge backlog/failures, and `az containerapp job execution list` success.

- [ ] **Step 9: Complete releases**

Create the repository releases/tags through each repository's existing release workflow only after its merged-main CI and production smoke pass. Plan B is complete only when the first enabled retention run matches the approved preflight and all Acceptance Boundary operations are verified.

## Final Acceptance Checklist

- [ ] Manager can list and server-search current names without reader ACL.
- [ ] Manager can use four views, desktop selection, load more, and the 100-item cap.
- [ ] Browser-native thumbnails fail safely to icons and never play grid video.
- [ ] Viewer supports image, video, audio, PDF, and unsupported-file download fallback.
- [ ] Rename keeps extension/content identity and reaches readers as an upsert without Blob redownload.
- [ ] Single/multiple download uses current names and separate ticket URLs without ZIP.
- [ ] Per-item permanent retention can be set/cleared; explicit delete remains irreversible.
- [ ] Manual and scheduled deletion emit the same tombstones and preserve referenced Assets.
- [ ] Each collection enforces 1..365 days, default 14, with retroactive expiry and no stored per-item expiry.
- [ ] Retention runs at 03:00 Asia/Taipei in batches of at most 100 after approved preflight.
- [ ] Gateway preserves ticket GET/HEAD/Range/ETag/no-store while forwarding no Admin identity headers.
- [ ] Logs, APIs, browser persistence, and analytics contain no forbidden identifiers or ticket URLs.
- [ ] All repository CI, deployment, production smoke, client reconciliation, and first-run retention checks pass.
