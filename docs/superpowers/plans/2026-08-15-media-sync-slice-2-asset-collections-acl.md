# Media Sync Slice 2: Asset Collections and ACL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generic, ACL-protected Asset API collections and a restricted LINE media namespace without activating any LINE group binding.

**Architecture:** Extend the existing Asset API service and PostgreSQL store rather than creating another service. Helper-only collection mutations stay behind the existing workload-auth boundary. Reader requests enter only through API Gateway, which validates HHC access tokens and passes normalized `X-HHC-*` identity headers over an exact Dapr caller boundary. Stable item-occurrence IDs plus created/deleted revisions provide lossless snapshot-to-delta handoff. A short-lived, hashed content ticket enables browser media elements while every content request still rechecks live collection ACL and membership.

**Tech Stack:** Go standard library HTTP, PostgreSQL embedded migrations, existing Asset API BlobStore, Nginx/API Gateway, Dapr service invocation, Go tests.

## Global Constraints

- Repositories:
  - `/Users/rayselfs/Projects/hhc/website/asset-api`
  - `/Users/rayselfs/Projects/hhc/website/api-gateway`
- Create one focused feature branch per repository from its current production branch.
- Do not add a `media-sync-api` service or a second authorization store.
- Reuse `assets.Service`, `assets.Repository`, `postgres.Store`, and `httpapi.Handler`.
- Collection schema and APIs remain generic; no LINE group ID belongs in Asset API.
- Only `hhc-line-function-bot` may call collection management routes.
- Only API Gateway may call authenticated reader routes.
- Reader access requires both `media_sync_user` and a live user/role ACL.
- A user with `media_sync_user` but no matching ACL receives an empty collection list; direct access to an existing unauthorized collection returns 403, while missing/deleted collections return 404.
- `media-sync:manage` does not imply read access.
- All collection mutations require `Idempotency-Key`.
- The idempotency key is accepted only from the header; request bodies never override it.
- Invalid/missing cursors return a bounded full snapshot.
- Tickets live at most five minutes, are hashed at rest, are never logged, and never bypass current ACL.
- Public reader activation is sequenced Asset API first, direct Dapr smoke second, Gateway last.
- Existing public/grant download routes and `line.group.file` policy remain unchanged.

---

## File Map

| Repository | File | Responsibility |
| --- | --- | --- |
| asset-api | `internal/migrations/sql/012_asset_collections.sql` | Collections, ACL, item, mutation replay, and ticket tables |
| asset-api | `internal/assets/types.go` | Collection, change, ACL, ticket, and repository contracts |
| asset-api | `internal/assets/policy.go` | Restricted `line.group.media-sync` namespace |
| asset-api | `internal/assets/media_validation.go` | Bounded shared MIME/container verification |
| asset-api | `internal/assets/media_validation_test.go` | Header/ZIP/LPDeck verification and cancellation tests |
| asset-api | `internal/assets/service.go` | Collection invariants, authorization, cursors, and tickets |
| asset-api | `internal/assets/service_test.go` | Unit authorization and mutation behavior |
| asset-api | `internal/scanqueue/job.go` | Scan-path media detection and size enforcement |
| asset-api | `internal/scanqueue/job_test.go` | Scan-path MIME/container and 200 MiB tests |
| asset-api | `internal/clamav/local.go` | Production `clamscan` size/stream limits |
| asset-api | `internal/clamav/local_test.go` | Local ClamAV option tests |
| asset-api | `cmd/scan-worker/main.go` | Production scan cap wiring |
| asset-api | `internal/postgres/store.go` | Transactional revisions, ACL, item, and ticket persistence |
| asset-api | `internal/postgres/store_integration_test.go` | PostgreSQL constraints and transaction tests |
| asset-api | `internal/httpapi/handler.go` | Internal management and gateway reader routes |
| asset-api | `internal/httpapi/handler_test.go` | Caller and identity authorization matrix |
| asset-api | `internal/config/config.go` | Dedicated reader caller app ID |
| asset-api | `internal/config/config_test.go` | Reader-caller configuration tests |
| asset-api | `infra/main.bicep` | Production reader caller app ID |
| asset-api | `scripts/test-release-workflow.sh` | Dedicated caller assertion |
| asset-api | `.github/workflows/release.yml` | Production configuration and release gates |
| api-gateway | `conf.d/common/media-cors.conf` | Narrow browser client CORS for authenticated media |
| api-gateway | `conf.d/map.conf` | Exact media client-origin allowlist |
| api-gateway | `conf.d/default.conf` | Exact protected Asset API routes |
| api-gateway | `internal/verifier/token.go` | Preserve verified access-token expiry |
| api-gateway | `internal/verifier/handler.go` | Emit normalized token-expiry header |
| api-gateway | `internal/verifier/verifier_test.go` | Header/claim verification tests |
| api-gateway | `conf.d/common/protected.conf` | Forward normalized token expiry |
| api-gateway | `conf.d/common/proxy.conf` | Clear external token-expiry headers |
| api-gateway | `scripts/test-media-sync-routing.sh` | Static route/auth/CORS assertions |
| api-gateway | `scripts/runtime-smoke.sh` | Embedded post-deploy reader/ticket/private route assertions |
| api-gateway | `.github/workflows/ci.yml` | Run the new route assertions |
| api-gateway | `.github/workflows/release.yml` | Run static assertions before deploy and the embedded smoke after deploy |

### Task 1: Add the collection persistence model

**Repository:** `asset-api`

**Files:**
- Create: `internal/migrations/sql/012_asset_collections.sql`
- Modify: `internal/postgres/store_integration_test.go`

**Schema:**

- `asset_collections(id, namespace, name, revision, created_by_service, created_at, updated_at, deleted_at)`
- `asset_collection_items(id, collection_id, asset_id nullable, remote_item_id, display_name, source_revision, created_revision, deleted_revision, created_at, deleted_at)`
- `asset_collection_acl(id, collection_id, subject_type, subject_id, permission, created_at, revoked_at)`
- `asset_collection_mutations(caller_service, operation, idempotency_key, request_fingerprint, response_json nullable, created_at)`
- `asset_content_tickets(token_hash, collection_id, collection_item_id, asset_etag, user_id, roles, expires_at, created_at)`

- [ ] **Step 1: Add failing migration integration tests**

Assert:

1. a collection starts at revision 1;
2. stable item IDs are nonblank and duplicate active `(collection_id, asset_id)` or `(collection_id, remote_item_id)` rows are rejected;
3. only `user|role` and `read` ACL values are accepted;
4. only one active ACL exists for a subject tuple;
5. revisions are positive and `created_revision <= deleted_revision` when deleted;
6. ticket hashes are lowercase 64-character SHA-256 values, `roles` is `text[]`, and each ticket references a concrete item occurrence;
7. `(caller_service, operation, idempotency_key)` is unique;
8. deleting and re-adding the same remote item creates a new occurrence without erasing the old tombstone;
9. asset hard deletion sets the historical item `asset_id` to null rather than deleting history or blocking retention cleanup.

- [ ] **Step 2: Run the focused test**

~~~bash
go test ./internal/postgres -run 'TestCollectionSchema' -count=1
~~~

Expected: failure because migration 12 is absent.

- [ ] **Step 3: Add the append-only migration**

Use PostgreSQL partial unique indexes for active item and ACL rows and indexes supporting
`created_revision`/`deleted_revision` scans. Use foreign keys with no cascade from collection to
assets: `asset_collection_items.asset_id` uses `ON DELETE SET NULL`, collection deletion is soft,
and asset lifecycle remains owner-controlled. Do not persist a
`created_by_subject` supplied by management JSON; the workload caller is the only trusted creator
identity in this slice.
The existing `//go:embed sql/*.sql` runner discovers migration 12 automatically; do not modify it.

- [ ] **Step 4: Re-run migration and full store tests**

~~~bash
gofmt -w internal/postgres/store_integration_test.go
go test ./internal/postgres -count=1
~~~

Expected: pass.

- [ ] **Step 5: Commit**

~~~bash
git add internal/migrations/sql/012_asset_collections.sql internal/postgres/store_integration_test.go
git commit -m "feat: add asset collection schema"
~~~

### Task 2: Implement transactional collection, ACL, item, and change operations

**Repository:** `asset-api`

**Files:**
- Modify: `internal/assets/types.go`
- Modify: `internal/assets/service.go`
- Modify: `internal/assets/service_test.go`
- Modify: `internal/clamav/worker.go`
- Modify: `internal/clamav/worker_test.go`
- Modify: `internal/postgres/store.go`
- Modify: `internal/postgres/store_integration_test.go`

**Interfaces:**

~~~go
type CollectionSubject struct {
	UserID string
	Roles  []string
}

type CollectionChangePage struct {
  Collection Collection
  Items      []CollectionItem
  Tombstones []CollectionTombstone
  Cursor     string
  HasMore    bool
  Reset      bool
}

func (s *Service) ListAuthorizedCollections(ctx context.Context, subject CollectionSubject, cursor string, limit int) (CollectionPage, error)
func (s *Service) GetAuthorizedCollection(ctx context.Context, id string, subject CollectionSubject) (Collection, error)
func (s *Service) CollectionChanges(ctx context.Context, id, cursor string, subject CollectionSubject) (CollectionChangePage, error)
~~~

Mutation inputs contain only the requested collection/ACL/item fields plus the trusted
`callerService`, operation, and header `Idempotency-Key`. Mutation outputs are the committed
collection revision and affected resource; the exact serialized output is stored for replay.

- [ ] **Step 1: Add failing service and store tests**

Cover create/replay/conflicting replay, rename, soft delete, ACL add/revoke, item add/tombstone,
bounded collection-list pagination, concurrent revision increments, a 501-item reset, and a mutation committed between reset pages.
Assert every successful mutation increments the collection revision exactly once in the same
transaction and no inter-page mutation is skipped. Assert item delete/re-add yields distinct
occurrence IDs and the old ticket cannot select the new occurrence. Run concurrent identical
CreateCollection calls with one idempotency key and assert one resource/one stored response; run
concurrent conflicting fingerprints and assert exactly one winner plus one conflict.

Exercise the existing asset lifecycle end to end: owner soft-delete atomically tombstones every
active collection membership and increments each affected collection once; blob purge still
completes; retention hard-delete sets historical item `asset_id` to null and does not remove the
occurrence, tombstone, or revision history.

- [ ] **Step 2: Run focused tests**

~~~bash
go test ./internal/assets ./internal/postgres -run 'Collection|ACL|Revision|Cursor' -count=1
~~~

Expected: compile/test failure for missing contracts.

- [ ] **Step 3: Add the minimum repository methods**

Before extending the existing `assets.Repository`, narrow the ClamAV/scan consumer to the smallest
existing methods it uses so unrelated scanner mocks do not implement collection operations. Keep
`assets.Service` on the single existing `assets.Repository`; do not create a second persistence
abstraction. In `postgres.Store`, use the single lock order below, re-read every live
collection/item/asset invariant after locking, apply the mutation, increment revision, and persist
the idempotent response before commit.

Claim idempotency by inserting the unique mutation key inside the same transaction before any
resource row exists. On conflict, lock/read that mutation row, compare the fingerprint, and replay
the committed response or return conflict. A failed transaction rolls back the claim; do not add a
separate lock service or advisory-lock layer.

Use one lock order to avoid lifecycle/membership deadlocks: mutation claim first when present,
asset row second when present, then collection rows in lexical ID order. Re-read all invariants after
the locks. Concurrent soft-delete and item-add must end with either a live membership or a tombstone,
never an active item referencing a deleted asset.

Encode cursors as base64url JSON. Delta cursors contain collection ID, from/to revisions, and page
position. Reset cursors contain collection ID, snapshot high-water revision, and the last stable item
occurrence ID. Snapshot rows are those with `created_revision <= highWater` and either no
`deleted_revision` or `deleted_revision > highWater`; delta pages are derived from created and
deleted revisions, including tombstones. Return at most 500 rows per page in a stable order. The
final reset page hands off to a bounded delta from the reset high-water revision before the provider
applies the collected full scan. A malformed cursor, wrong collection ID, or cursor ahead of the
server starts `Reset: true` paging rather than returning an error.

- [ ] **Step 4: Add live authorization queries**

`ListAuthorizedCollections`, `GetAuthorizedCollection`, and every collection read must match:

1. the global role `media_sync_user`; and
2. either a live user ACL for `subject.UserID` or a live role ACL intersecting `subject.Roles`.

Do not treat wildcard admin or `media-sync:manage` as a reader bypass.
Return `200` with an empty page when the subject has the global role but no collection ACL. For
direct access, distinguish existing-but-unauthorized (403) from missing or deleted (404) without
leaking collection details.

Change the existing PostgreSQL `SoftDeleteAsset` path to lock the asset and all active memberships
in one transaction, allocate the next revision independently for each affected collection, and
write item tombstones before marking the asset deleted. The existing purge worker remains unchanged;
the Task 1 `ON DELETE SET NULL` FK makes its final retention delete safe. Repeated soft-delete is a
no-op for collection revisions and cannot emit duplicate tombstones.

- [ ] **Step 5: Validate**

~~~bash
gofmt -w internal/assets/types.go internal/assets/service.go internal/assets/service_test.go internal/clamav/worker.go internal/clamav/worker_test.go internal/postgres/store.go internal/postgres/store_integration_test.go
go test ./internal/assets ./internal/clamav ./internal/postgres -count=1
~~~

Expected: pass.

- [ ] **Step 6: Commit**

~~~bash
git add internal/assets internal/clamav/worker.go internal/clamav/worker_test.go internal/postgres
git commit -m "feat: add transactional asset collections"
~~~

### Task 3: Add the restricted media-sync namespace and scan-gated membership

**Repository:** `asset-api`

**Files:**
- Modify: `internal/assets/policy.go`
- Modify: `internal/assets/policy_test.go`
- Create: `internal/assets/media_validation.go`
- Create: `internal/assets/media_validation_test.go`
- Modify: `internal/assets/service.go`
- Modify: `internal/assets/service_test.go`
- Modify: `internal/scanqueue/job.go`
- Modify: `internal/scanqueue/job_test.go`
- Modify: `internal/clamav/local.go`
- Modify: `internal/clamav/local_test.go`
- Modify: `cmd/scan-worker/main.go`
- Modify: `infra/main.bicep`
- Modify: `.github/workflows/release.yml`

**Policy:**

- Namespace: `line.group.media-sync`
- Owner service: `hhc-line-function-bot`
- Maximum: 200 MiB
- Allowed: JPEG, PNG, GIF, WebP, BMP, MP4, MOV, WebM, OGV, AVI, MKV, WMV, MP3, WAV, M4A, AAC, OGG, PDF, PPTX, LPDeck
- Rejected: SVG, PPT, KEY, ODP, MPEG video, TIFF, HEIC, HEIF

Canonical mappings are `image/jpeg` (JPG/JPEG), `image/png`, `image/gif`, `image/webp`,
`image/bmp`, `video/mp4`, `video/quicktime` (MOV), `video/webm`, `video/ogg` (OGV),
`video/x-msvideo` (AVI), `video/x-matroska` (MKV), `video/x-ms-wmv` (WMV), `audio/mpeg`
(MP3), `audio/wav`, `audio/mp4` (M4A), `audio/aac`, `audio/ogg`, `application/pdf`,
`application/vnd.openxmlformats-officedocument.presentationml.presentation`, and
`application/vnd.librepresenter.presentation+json` (LPDeck). LPDeck is JSON, not a ZIP container.
Container aliases are normalized before the exact MIME/extension pair is evaluated.

- [ ] **Step 1: Add failing policy table tests**

Test every accepted and rejected extension/MIME pair at the 200 MiB boundary, including upload
completion and scan-job detection. Prove ZIP/PPTX and LPDeck validation do not allocate/read the
whole object into memory, respect context cancellation, clean temporary files, and reject content
that does not match its declared container. Preserve all current `line.group.file` assertions at
25 MiB.

- [ ] **Step 2: Add failing item-membership tests**

Assert `AddCollectionItem` rejects:

- a pending, failed, infected, deleted, or processing asset;
- an asset outside the collection namespace;
- an asset not owned by the calling helper;
- an idempotency replay with a different asset or display name.

- [ ] **Step 3: Implement the policy and membership guard**

Add one policy entry. Extract the existing normalization and ZIP/container checks into one bounded
`assets` function used by both upload completion and `scanqueue.ScanJob`; there is no existing shared
detector to wrap. It accepts a fixed-size header plus `io.ReaderAt`/size for containers. For remote
uploads that require container inspection, stream at most the declared size plus one byte to a
temporary file and use `archive/zip.NewReader`; remove the current whole-object `io.ReadAll` path.
Exact header-detected media avoids the temporary file. LPDeck is checked as the declared JSON media
type with a bounded prefix/extension contract and is never treated as ZIP.

Before committing membership,
lock and recheck upload complete, scan clean, processing ready/not-required, matching namespace,
matching owner service, and live asset in the same transaction to close the scan/deletion TOCTOU
window.

Keep storage inspection and `clamscan --max-filesize` bounded by the 200 MiB outer upload limit, but
do not reuse that value for archive expansion. Set `--max-scansize` to a separate 1 GiB total
decompressed budget, with at most 10,000 entries, recursion depth 32, and no extracted entry larger
than 200 MiB. Enable ClamAV's exceeded-limit and encrypted-container alerts so any outer-size,
expanded-size, entry-count, recursion, encrypted, or timeout ceiling is fail-closed and can never be
reported as `ScanClean`. Raise the production scan timeout from two to ten minutes and ensure the
Container Apps job timeout remains greater than the scan timeout. Wire outer size and decompressed
budget separately through `cmd/scan-worker` and production Bicep. Keep the policy-level
`line.group.file` maximum at 25 MiB. Add boundary, compressed-container, limit-alert, timeout,
cleanup, and release-policy assertions so no lower layer silently accepts a partially scanned
object. Do not raise the API container memory merely to retain the old `ReadAll` implementation.

- [ ] **Step 4: Validate**

~~~bash
gofmt -w internal/assets/policy.go internal/assets/policy_test.go internal/assets/media_validation.go internal/assets/media_validation_test.go internal/assets/service.go internal/assets/service_test.go internal/scanqueue/job.go internal/scanqueue/job_test.go internal/clamav/local.go internal/clamav/local_test.go cmd/scan-worker/main.go
go test ./internal/assets ./internal/scanqueue ./internal/clamav ./cmd/scan-worker -count=1
./scripts/test-release-workflow.sh
~~~

Expected: pass and existing namespace tests remain unchanged.

- [ ] **Step 5: Commit**

~~~bash
git add internal/assets internal/scanqueue internal/clamav cmd/scan-worker/main.go infra/main.bicep .github/workflows/release.yml
git commit -m "feat: add scan-gated LINE media namespace"
~~~

### Task 4: Expose helper-only collection management routes

**Repository:** `asset-api`

**Files:**
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/handler_test.go`
- Modify: `cmd/server/main.go`

**Routes:**

- `GET /priv/assets/collections`
- `GET /priv/assets/collections/{collectionId}`
- `POST /priv/assets/collections`
- `PATCH /priv/assets/collections/{collectionId}`
- `DELETE /priv/assets/collections/{collectionId}`
- `POST /priv/assets/collections/{collectionId}/acl`
- `DELETE /priv/assets/collections/{collectionId}/acl/{aclId}`
- `POST /priv/assets/collections/{collectionId}/items`
- `DELETE /priv/assets/collections/{collectionId}/items/{itemId}`

- [ ] **Step 1: Add route authorization tests**

For every route, assert missing caller, API Gateway caller, and another allowed Asset API caller receive 403; `hhc-line-function-bot` reaches the handler. Assert absent/blank `Idempotency-Key` on mutations returns 400 and never mutates storage, and a body field cannot supply or override it.

- [ ] **Step 2: Run the handler tests**

~~~bash
go test ./internal/httpapi -run 'CollectionManagement|CollectionCaller' -count=1
~~~

Expected: failure because routes do not exist.

- [ ] **Step 3: Add a helper-only middleware**

Keep existing generic `internal` workload validation, then require exact caller `hhc-line-function-bot` for these routes. Pass caller service into the service input; never accept owner/caller identity from JSON. Management list is cursor-paginated; management GET calls the Task 2 collection service and returns collection plus ACL metadata but never content/blob keys.

- [ ] **Step 4: Add bounded request validation**

Trim collection names and display names. Use explicit limits: collection name 1–120 UTF-8 bytes,
item display name 1–255 UTF-8 bytes, `remoteItemId` 1–255 bytes in management JSON, and
`Idempotency-Key` 1–128 bytes. Validate opaque collection/item IDs; source `remoteItemId` is returned
as metadata but is never used as a reader URL locator. Reject unknown JSON fields and reject a second trailing JSON value after the
first object. Use the existing error envelope and request ID.

- [ ] **Step 5: Validate and commit**

~~~bash
gofmt -w internal/httpapi/handler.go internal/httpapi/handler_test.go cmd/server/main.go
go test ./internal/httpapi ./cmd/server -count=1
git add internal/httpapi cmd/server/main.go
git commit -m "feat: expose collection management API"
~~~

### Task 5: Expose authenticated reader APIs through the Gateway boundary

**Repository:** `asset-api`

**Files:**
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/handler_test.go`
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `cmd/server/main.go`
- Modify: `infra/main.bicep`
- Modify: `scripts/test-release-workflow.sh`
- Modify: `.github/workflows/release.yml`

**Routes:**

- `GET /api/assets/collections`
- `GET /api/assets/collections/{collectionId}/changes`
- `GET /api/assets/collections/{collectionId}/items/{itemId}`
- `POST /api/assets/collections/{collectionId}/items/{itemId}/content-ticket`
- `GET /api/assets/collections/{collectionId}/items/{itemId}/content`

- [ ] **Step 1: Add the reader authorization matrix**

Test missing/forged caller, missing user, missing global role, user ACL, role ACL, manager-only user, revoked ACL, deleted collection, inaccessible item, and API Gateway caller with valid normalized headers.

Use actual headers:

~~~text
X-HHC-User-ID
X-HHC-Roles
X-HHC-Token-ID
X-HHC-Token-Expires-At
X-HHC-Session-ID
X-HHC-Auth-Provider
~~~

- [ ] **Step 2: Run focused tests**

~~~bash
go test ./internal/httpapi -run 'CollectionReader|ReaderAuthorization' -count=1
~~~

Expected: failure because reader routes are absent.

- [ ] **Step 3: Add gateway-only identity parsing**

Require a workload-authenticated caller matching `api-gateway` before trusting normalized headers.
Parse roles as the Account API's existing delimiter format, trim/deduplicate them, parse
`X-HHC-Token-Expires-At` as positive Unix seconds, and reject blank user identity or invalid expiry.
Reader routes call service authorization for every request; do not cache ACL decisions in the
handler.

Add `ASSET_READER_CALLER_APP_ID` with production/default value `api-gateway` and a release-policy
assertion. This value is the authenticated Dapr app ID, not an HTTP host or Azure resource name.
Reader/ticket middleware requires that exact authenticated caller. Do not add Gateway to
`ASSET_ALLOWED_CALLERS`; existing internal asset routes remain unavailable to it. Update the ACA
ingress/workload-auth exclusion list only for the exact reader, bearer item-content, and ticket
content paths so requests can reach the application-level Dapr caller check; do not exempt a prefix
or admit Gateway to private management routes. Keep the helper-only management middleware unchanged.

- [ ] **Step 4: Return sync-safe metadata**

Return opaque collection/item occurrence IDs, source `remoteItemId`, display name, MIME, size,
ETag/source revision, timestamps, tombstones, reset flag, and next cursor. The client keys content and
tickets by opaque `itemId`; `remoteItemId` is provider reconciliation metadata only. Never return
blob keys, LINE identifiers, owner internals, or ticket hashes.

- [ ] **Step 5: Validate and commit**

~~~bash
gofmt -w internal/httpapi/handler.go internal/httpapi/handler_test.go internal/config/config.go internal/config/config_test.go cmd/server/main.go
go test ./internal/httpapi ./internal/assets ./internal/config -count=1
./scripts/test-release-workflow.sh
git add internal/httpapi internal/config infra/main.bicep scripts/test-release-workflow.sh .github/workflows/release.yml cmd/server/main.go
git commit -m "feat: expose authorized collection reader API"
~~~

### Task 6: Add short-lived content tickets and range streaming

**Repository:** `asset-api`

**Files:**
- Modify: `internal/assets/types.go`
- Modify: `internal/assets/service.go`
- Modify: `internal/assets/service_test.go`
- Modify: `internal/postgres/store.go`
- Modify: `internal/postgres/store_integration_test.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/handler_test.go`

**Ticket contract:**

~~~json
{
  "contentUrl": "/api/assets/content?ticket={opaque}",
  "expiresAt": "2026-08-15T12:00:00Z",
  "etag": "\"asset-version\""
}
~~~

- [ ] **Step 1: Add failing ticket lifecycle tests**

Cover 32-byte random token generation, SHA-256-only persistence, five-minute maximum,
`min(now+5m, X-HHC-Token-Expires-At)`, already-expired/malformed token expiry, single
collection/item-occurrence/content version scope, expiry, ETag replacement, delete/re-add of the
same remote item, deleted membership, collection delete, user ACL revoke, role ACL revoke, and token
absence from logs/error bodies.

- [ ] **Step 2: Add conditional and range tests**

Exercise full GET, HEAD, `If-None-Match`, valid single range, suffix range, unsatisfiable range, and
resumed video range through protected collection-item content with normal Gateway identity and exact
`/api/assets/content?ticket=...` with ticket authorization. Reuse `serveDownload` and BlobStore
range behavior.

- [ ] **Step 3: Implement ticket issue/validation**

Generate tokens with `crypto/rand`, persist only SHA-256, and use constant-time hash comparison where
comparison is in-process. Bind the ticket to the stable collection item occurrence ID, live asset
ETag, issuer user, and issuer role snapshot so every ticket request can re-evaluate the same live ACL
without accepting new external identity. This gives bounded role-revocation exposure of at most the
ticket TTL (five minutes); direct user/ACL/item/collection revocation is rechecked immediately.
Purge expired rows opportunistically during issue/lookup; no new worker is needed.

The exact ticket handler still requires the workload-authenticated `api-gateway` caller, rejects a
missing ticket before blob access, clears/ignores every external `X-HHC-*` header, and never selects
an item by `remote_item_id` alone.

- [ ] **Step 4: Keep ticket values out of telemetry**

Do not log query strings on this route. Error messages expose only stable category codes. Responses set:

~~~text
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Accept-Ranges: bytes
ETag: <asset etag>
~~~

Gateway may retain its stricter site-wide referrer policy; tests assert the effective response is at
least as restrictive and do not require Gateway to overwrite it with a weaker value.

- [ ] **Step 5: Validate and commit**

~~~bash
gofmt -w internal/assets/types.go internal/assets/service.go internal/assets/service_test.go internal/postgres/store.go internal/postgres/store_integration_test.go internal/httpapi/handler.go internal/httpapi/handler_test.go
go test ./internal/assets ./internal/postgres ./internal/httpapi -count=1
git add internal/assets internal/postgres internal/httpapi
git commit -m "feat: stream authorized collection content"
~~~

- [ ] **Step 6: Release Asset API inertly before Gateway**

Open the focused Asset API PR, require CI and PostgreSQL integration, merge/release it, then perform
direct Dapr smokes as `api-gateway`: missing bearer identity reaches the reader and returns 401,
missing/invalid ticket reaches the exact ticket handler without blob access, and private management
remains unavailable. Do not publish Gateway routes until these smokes pass.

### Task 7: Publish exact reader and ticket routes through API Gateway

**Repository:** `api-gateway`

**Files:**
- Create: `conf.d/common/media-cors.conf`
- Modify: `conf.d/map.conf`
- Modify: `conf.d/default.conf`
- Modify: `internal/verifier/token.go`
- Modify: `internal/verifier/handler.go`
- Modify: `internal/verifier/verifier_test.go`
- Modify: `conf.d/common/protected.conf`
- Modify: `conf.d/common/proxy.conf`
- Create: `scripts/test-media-sync-routing.sh`
- Modify: `scripts/runtime-smoke.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `README.md`

- [ ] **Step 1: Add `scripts/test-media-sync-routing.sh`**

First add a verifier test that `Claims` preserves verified `exp` and the handler emits
`X-HHC-Token-Expires-At` as Unix seconds. Then follow `scripts/test-auth-routing.sh` and
`scripts/test-www-routing.sh`. Prove:

- list/changes/metadata and bearer item-content routes include `protected.conf`;
- the `www` server has an internal `/_auth/jwt` verifier and reader locations set required role
  `media_sync_user` plus a stable route ID;
- exact `/api/assets/content` does not include `protected.conf`, accepts only GET/HEAD/OPTIONS, and
  strips external Authorization and identity headers;
- the proxy strips the external Authorization header before forwarding normalized identity;
- `proxy.conf` clears external `X-HHC-Token-Expires-At` and `protected.conf` forwards only the
  auth-subrequest value;
- `/priv/assets/*` remains 404 from every public host;
- a dedicated exact-origin map allows only `https://client.alive.org.tw` and documented local
  origins; no broad site/account CORS map is reused and credentials stay off;
- every new media route on `www-test.alive.org.tw` returns 404, and `client-test.alive.org.tw`
  receives no ACAO while `asset-api-test` is absent;
- preflight allows `Authorization, Accept, Content-Type, Range, If-None-Match, If-Range`;
- responses expose `ETag, Accept-Ranges, Content-Range, Content-Length, X-HHC-Request-ID`.
- CI and release verification both run static routing assertions and syntax-check the embedded
  `scripts/runtime-smoke.sh`; the existing post-deploy `az containerapp exec` runs that embedded
  smoke against live Dapr backends and proves a reader request reaches 401, missing ticket reaches
  Asset API safely, and private collection routes remain 404.

- [ ] **Step 2: Add exact locations**

On `www.alive.org.tw` only, add the same internal
`/_auth/jwt` verifier contract already used by the admin server. Use exact or anchored locations,
never a broad `/api/assets/` prefix. Set `$hhc_required_roles` to `media_sync_user`, set a stable
`$hhc_route_id`, include `protected.conf` and `media-cors.conf`, and proxy to `$asset_api_base` with
these method groups:

- collection list, changes, item metadata, and bearer item content: GET/HEAD/OPTIONS;
- item-scoped content-ticket issue: POST/OPTIONS;
- exact `/api/assets/content`: GET/HEAD/OPTIONS without `protected.conf`.

The shared www server block also accepts `www-test.alive.org.tw`, but its configured upstream is
`asset-api-test`, which is not deployed. Guard all new media reader locations so the test host and
`client-test` origin remain unavailable (404/no ACAO) in this slice. Add them only with a separate
reviewed `asset-api-test` database/migration/runtime release; never point test traffic at production
Asset API.

Add a separate exact `/api/assets/content` location that accepts only GET/HEAD/OPTIONS, never
includes `protected.conf`, strips external identity/Authorization headers, and proxies through the
Gateway Dapr identity. Apply the existing API rate limit and `streaming.conf`. Asset API serves it
only after opaque-ticket validation. Keep query strings out of access logs; the existing JSON
format's `$uri` field must remain unchanged.

- [ ] **Step 3: Validate routing policy and the built image**

Add the static script to both CI and release verify jobs, extend the existing embedded runtime smoke,
and keep its current post-deploy execution. Then run:

~~~bash
go test ./...
./scripts/test-auth-routing.sh
./scripts/test-www-routing.sh
./scripts/test-media-sync-routing.sh
docker build --build-arg "RELEASE=media-sync-local" -t api-gateway:media-sync .
sh -n scripts/runtime-smoke.sh
~~~

Expected: route assertions and image build pass.

- [ ] **Step 4: Commit**

~~~bash
git add conf.d/common/media-cors.conf conf.d/map.conf conf.d/default.conf conf.d/common/protected.conf conf.d/common/proxy.conf internal/verifier scripts/test-media-sync-routing.sh scripts/runtime-smoke.sh .github/workflows/ci.yml .github/workflows/release.yml README.md
git commit -m "feat: route protected asset collections"
~~~

- [ ] **Step 5: Publish and smoke Gateway**

Open the focused Gateway PR only after the Asset API direct Dapr smoke is green. Require CI, merge,
release, and verify the full user ACL, role ACL, Range/If-Range, revoked ACL, invalid-ticket, and
private-route matrix through the public hosts before Slice 2 is complete.

## Slice Gate

- [ ] Asset API focused tests pass:

~~~bash
go test ./internal/assets ./internal/postgres ./internal/httpapi -count=1
~~~

- [ ] Asset API full validation passes:

~~~bash
go test ./...
go build ./cmd/...
~~~

- [ ] Run PostgreSQL integration tests with the repository's documented test database.
- [ ] Run the authorization matrix through Gateway and Asset API with user ACL, role ACL, no ACL, revoked ACL, and deleted collection.
- [ ] Verify conditional/range behavior through Gateway, including a ticket issued before ACL revoke and reused after revoke.
- [ ] Confirm `/priv/assets/collections` is not externally reachable.
- [ ] Confirm no binding row exists and no LINE group behavior changes in this slice.
- [ ] Record both commit SHAs and CI URLs in the implementation handoff.

## Rollback

- Revert Gateway reader locations first to remove external reachability.
- Revert Asset API application commits while leaving migration 12 tables in place; the migration is additive and inert.
- Do not drop collection tables in production rollback. A later reviewed cleanup migration may remove them only after confirming they contain no retained data.
