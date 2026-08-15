# Media Sync Slice 2: Asset Collections and ACL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add generic, ACL-protected Asset API collections and a restricted LINE media namespace without activating any LINE group binding.

**Architecture:** Extend the existing Asset API service and PostgreSQL store rather than creating another service. Helper-only collection mutations stay behind the existing workload-auth boundary. Reader requests enter only through API Gateway, which validates HHC access tokens and passes the existing `X-HHC-*` identity headers. A short-lived, hashed content ticket enables browser media elements while every content request still rechecks live collection ACL and membership.

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
- `media-sync:manage` does not imply read access.
- All collection mutations require `Idempotency-Key`.
- Invalid/missing cursors return a bounded full snapshot.
- Tickets live at most five minutes, are hashed at rest, are never logged, and never bypass current ACL.
- Existing public/grant download routes and `line.group.file` policy remain unchanged.

---

## File Map

| Repository | File | Responsibility |
| --- | --- | --- |
| asset-api | `internal/migrations/sql/012_asset_collections.sql` | Collections, ACL, item, mutation replay, and ticket tables |
| asset-api | `internal/assets/types.go` | Collection, change, ACL, ticket, and repository contracts |
| asset-api | `internal/assets/policy.go` | Restricted `line.group.media-sync` namespace |
| asset-api | `internal/assets/service.go` | Collection invariants, authorization, cursors, and tickets |
| asset-api | `internal/assets/service_test.go` | Unit authorization and mutation behavior |
| asset-api | `internal/postgres/store.go` | Transactional revisions, ACL, item, and ticket persistence |
| asset-api | `internal/postgres/store_integration_test.go` | PostgreSQL constraints and transaction tests |
| asset-api | `internal/httpapi/handler.go` | Internal management and gateway reader routes |
| asset-api | `internal/httpapi/handler_test.go` | Caller and identity authorization matrix |
| asset-api | `internal/config/config.go` | Dedicated reader caller app ID |
| asset-api | `internal/config/config_test.go` | Reader-caller configuration tests |
| asset-api | `infra/main.bicep` | Production reader caller app ID |
| asset-api | `scripts/test-release-workflow.sh` | Dedicated caller assertion |
| api-gateway | `conf.d/common/media-cors.conf` | Narrow browser client CORS for authenticated media |
| api-gateway | `conf.d/default.conf` | Exact protected Asset API routes |
| api-gateway | `internal/verifier/token.go` | Preserve verified access-token expiry |
| api-gateway | `internal/verifier/handler.go` | Emit normalized token-expiry header |
| api-gateway | `internal/verifier/verifier_test.go` | Header/claim verification tests |
| api-gateway | `conf.d/common/protected.conf` | Forward normalized token expiry |
| api-gateway | `conf.d/common/proxy.conf` | Clear external token-expiry headers |
| api-gateway | `scripts/test-media-sync-routing.sh` | Static route/auth/CORS assertions |
| api-gateway | `.github/workflows/ci.yml` | Run the new route assertions |

### Task 1: Add the collection persistence model

**Repository:** `asset-api`

**Files:**
- Create: `internal/migrations/sql/012_asset_collections.sql`
- Modify: `internal/postgres/store_integration_test.go`

**Schema:**

- `asset_collections(id, namespace, name, revision, created_by_service, created_by_subject, created_at, updated_at, deleted_at)`
- `asset_collection_items(collection_id, asset_id, remote_item_id, display_name, source_revision, created_at, deleted_at)`
- `asset_collection_acl(id, collection_id, subject_type, subject_id, permission, created_at, revoked_at)`
- `asset_collection_mutations(caller_service, operation, idempotency_key, request_fingerprint, response_json, created_at)`
- `asset_content_tickets(token_hash, collection_id, remote_item_id, asset_etag, user_id, roles, expires_at, created_at)`

- [ ] **Step 1: Add failing migration integration tests**

Assert:

1. a collection starts at revision 1;
2. duplicate active asset membership and duplicate `remote_item_id` are rejected;
3. only `user|role` and `read` ACL values are accepted;
4. only one active ACL exists for a subject tuple;
5. ticket tokens are stored only as SHA-256 hashes;
6. deleting and re-adding an item preserves its identity history.

- [ ] **Step 2: Run the focused test**

~~~bash
go test ./internal/postgres -run 'TestCollectionSchema' -count=1
~~~

Expected: failure because migration 12 is absent.

- [ ] **Step 3: Add the append-only migration**

Use PostgreSQL partial unique indexes for active item and ACL rows. Use foreign keys with no cascade
from collection to assets: collection deletion is soft and asset lifecycle remains owner-controlled.
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

func (s *Service) ListAuthorizedCollections(ctx context.Context, subject CollectionSubject) ([]Collection, error)
func (s *Service) CollectionChanges(ctx context.Context, id, cursor string, subject CollectionSubject) (CollectionChangePage, error)
~~~

- [ ] **Step 1: Add failing service and store tests**

Cover create/replay/conflicting replay, rename, soft delete, ACL add/revoke, item add/tombstone,
concurrent revision increments, a 501-item reset, and a mutation committed between reset pages.
Assert every successful mutation increments the collection revision exactly once in the same
transaction and no inter-page mutation is skipped.

- [ ] **Step 2: Run focused tests**

~~~bash
go test ./internal/assets ./internal/postgres -run 'Collection|ACL|Revision|Cursor' -count=1
~~~

Expected: compile/test failure for missing contracts.

- [ ] **Step 3: Add the minimum repository methods**

Extend the existing `assets.Repository` contract; do not create a second repository abstraction. In `postgres.Store`, lock the collection row with `FOR UPDATE`, apply the mutation, increment revision, and persist the idempotent response before commit.

Encode cursors as base64url JSON. Delta cursors contain collection ID, from/to revisions, and page
position. Reset cursors contain collection ID, snapshot high-water revision, and last
`remote_item_id`. Return at most 500 rows per page. The final reset page hands off to a bounded delta
from the reset high-water revision before the provider applies the collected full scan. A malformed
cursor, wrong collection ID, or cursor ahead of the server starts `Reset: true` paging rather than
returning an error.

- [ ] **Step 4: Add live authorization queries**

`ListAuthorizedCollections` and every collection read must match:

1. the global role `media_sync_user`; and
2. either a live user ACL for `subject.UserID` or a live role ACL intersecting `subject.Roles`.

Do not treat wildcard admin or `media-sync:manage` as a reader bypass.

- [ ] **Step 5: Validate**

~~~bash
gofmt -w internal/assets/types.go internal/assets/service.go internal/assets/service_test.go internal/postgres/store.go internal/postgres/store_integration_test.go
go test ./internal/assets ./internal/postgres -count=1
~~~

Expected: pass.

- [ ] **Step 6: Commit**

~~~bash
git add internal/assets internal/postgres
git commit -m "feat: add transactional asset collections"
~~~

### Task 3: Add the restricted media-sync namespace and scan-gated membership

**Repository:** `asset-api`

**Files:**
- Modify: `internal/assets/policy.go`
- Modify: `internal/assets/policy_test.go`
- Modify: `internal/assets/service.go`
- Modify: `internal/assets/service_test.go`

**Policy:**

- Namespace: `line.group.media-sync`
- Owner service: `hhc-line-function-bot`
- Maximum: 200 MiB
- Allowed: JPEG, PNG, GIF, WebP, BMP, MP4, MOV, WebM, OGV, AVI, MKV, WMV, MP3, WAV, M4A, AAC, OGG, PDF, PPTX, LPDeck
- Rejected: SVG, PPT, KEY, ODP, MPEG video, TIFF, HEIC, HEIF

- [ ] **Step 1: Add failing policy table tests**

Test accepted and rejected extension/MIME pairs at the 200 MiB boundary. Preserve all current `line.group.file` assertions at 25 MiB.

- [ ] **Step 2: Add failing item-membership tests**

Assert `AddCollectionItem` rejects:

- a pending, failed, infected, deleted, or processing asset;
- an asset outside the collection namespace;
- an asset not owned by the calling helper;
- an idempotency replay with a different asset or display name.

- [ ] **Step 3: Implement the policy and membership guard**

Add one policy entry and reuse existing MIME normalization and detection. Before opening the membership transaction, require upload complete, scan clean, processing ready/not-required, matching namespace, and live asset.

- [ ] **Step 4: Validate**

~~~bash
gofmt -w internal/assets/policy.go internal/assets/policy_test.go internal/assets/service.go internal/assets/service_test.go
go test ./internal/assets -count=1
~~~

Expected: pass and existing namespace tests remain unchanged.

- [ ] **Step 5: Commit**

~~~bash
git add internal/assets
git commit -m "feat: add scan-gated LINE media namespace"
~~~

### Task 4: Expose helper-only collection management routes

**Repository:** `asset-api`

**Files:**
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/handler_test.go`
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `infra/main.bicep`
- Modify: `scripts/test-release-workflow.sh`
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
- `DELETE /priv/assets/collections/{collectionId}/items/{remoteItemId}`

- [ ] **Step 1: Add route authorization tests**

For every route, assert missing caller, API Gateway caller, and another allowed Asset API caller receive 403; `hhc-line-function-bot` reaches the handler. Assert absent `Idempotency-Key` on mutations returns 400 and never mutates storage.

- [ ] **Step 2: Run the handler tests**

~~~bash
go test ./internal/httpapi -run 'CollectionManagement|CollectionCaller' -count=1
~~~

Expected: failure because routes do not exist.

- [ ] **Step 3: Add a helper-only middleware**

Keep existing generic `internal` workload validation, then require exact caller `hhc-line-function-bot` for these routes. Pass caller service into the service input; never accept owner/caller identity from JSON. Management GET returns collection and ACL metadata but never content/blob keys.

- [ ] **Step 4: Add bounded request validation**

Trim collection names, cap names and display names at the documented UI limits, reject unknown JSON fields, validate IDs, and use the existing error envelope and request ID.

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
- Modify: `cmd/server/main.go`

**Routes:**

- `GET /api/assets/collections`
- `GET /api/assets/collections/{collectionId}/changes`
- `GET /api/assets/collections/{collectionId}/items/{remoteItemId}`
- `POST /api/assets/collections/{collectionId}/items/{remoteItemId}/content-ticket`
- `GET /api/assets/collections/{collectionId}/items/{remoteItemId}/content`

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
assertion. Reader/ticket middleware requires that exact authenticated caller. Do not add Gateway to
`ASSET_ALLOWED_CALLERS`; existing internal asset routes remain unavailable to it. Keep the
helper-only management middleware unchanged.

- [ ] **Step 4: Return sync-safe metadata**

Return opaque IDs, stable `remoteItemId`, display name, MIME, size, ETag/source revision, timestamps, tombstones, reset flag, and next cursor. Never return blob keys, LINE identifiers, owner internals, or ticket hashes.

- [ ] **Step 5: Validate and commit**

~~~bash
gofmt -w internal/httpapi/handler.go internal/httpapi/handler_test.go internal/config/config.go internal/config/config_test.go cmd/server/main.go
go test ./internal/httpapi ./internal/assets ./internal/config -count=1
./scripts/test-release-workflow.sh
git add internal/httpapi internal/config infra/main.bicep scripts/test-release-workflow.sh cmd/server/main.go
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
collection/item/content version scope, expiry, ETag replacement, deleted membership, collection
delete, user ACL revoke, role ACL revoke, and token absence from logs/error bodies.

- [ ] **Step 2: Add conditional and range tests**

Exercise full GET, HEAD, `If-None-Match`, valid single range, suffix range, unsatisfiable range, and
resumed video range through protected collection-item content with normal Gateway identity and exact
`/api/assets/content?ticket=...` with ticket authorization. Reuse `serveDownload` and BlobStore
range behavior.

- [ ] **Step 3: Implement ticket issue/validation**

Generate tokens with `crypto/rand`, persist only SHA-256, and use constant-time hash comparison where comparison is in-process. Store issuer user/roles so every ticket request can re-evaluate live ACL. Purge expired rows opportunistically during issue/lookup; no new worker is needed.

The exact ticket handler still requires the workload-authenticated `api-gateway` caller, rejects a
missing ticket before blob access, and never trusts external `X-HHC-*` headers.

- [ ] **Step 4: Keep ticket values out of telemetry**

Do not log query strings on this route. Error messages expose only stable category codes. Responses set:

~~~text
Cache-Control: private, no-store
Referrer-Policy: no-referrer
Accept-Ranges: bytes
ETag: <asset etag>
~~~

- [ ] **Step 5: Validate and commit**

~~~bash
gofmt -w internal/assets/types.go internal/assets/service.go internal/assets/service_test.go internal/postgres/store.go internal/postgres/store_integration_test.go internal/httpapi/handler.go internal/httpapi/handler_test.go
go test ./internal/assets ./internal/postgres ./internal/httpapi -count=1
git add internal/assets internal/postgres internal/httpapi
git commit -m "feat: stream authorized collection content"
~~~

### Task 7: Publish exact reader and ticket routes through API Gateway

**Repository:** `api-gateway`

**Files:**
- Create: `conf.d/common/media-cors.conf`
- Modify: `conf.d/default.conf`
- Modify: `internal/verifier/token.go`
- Modify: `internal/verifier/handler.go`
- Modify: `internal/verifier/verifier_test.go`
- Modify: `conf.d/common/protected.conf`
- Modify: `conf.d/common/proxy.conf`
- Create: `scripts/test-media-sync-routing.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Add `scripts/test-media-sync-routing.sh`**

First add a verifier test that `Claims` preserves verified `exp` and the handler emits
`X-HHC-Token-Expires-At` as Unix seconds. Then follow `scripts/test-auth-routing.sh` and
`scripts/test-www-routing.sh`. Prove:

- reader routes include `protected.conf`;
- the `www` server has an internal `/_auth/jwt` verifier and reader locations set required role
  `media_sync_user` plus a stable route ID;
- exact `/api/assets/content` does not include `protected.conf`, accepts only GET/HEAD/OPTIONS, and
  strips external Authorization and identity headers;
- the proxy strips the external Authorization header before forwarding normalized identity;
- `proxy.conf` clears external `X-HHC-Token-Expires-At` and `protected.conf` forwards only the
  auth-subrequest value;
- `/priv/assets/*` remains 404 from every public host;
- only `https://client.alive.org.tw` and the current test/local client origins receive media CORS;
- preflight allows `Authorization, Accept, Content-Type, Range, If-None-Match`;
- responses expose `ETag, Accept-Ranges, Content-Range, Content-Length, X-HHC-Request-ID`.

- [ ] **Step 2: Add exact locations**

On the `www.alive.org.tw` / `www-test.alive.org.tw` server only, add the same internal
`/_auth/jwt` verifier contract already used by the admin server. Add exact/prefix locations for
`/api/assets/collections`, set `$hhc_required_roles` to `media_sync_user` and a stable
`$hhc_route_id`, include `protected.conf` and `media-cors.conf`, allow only
GET/HEAD/POST/OPTIONS as required by the route, and proxy to `$asset_api_base`.

Add a separate exact `/api/assets/content` location that accepts only GET/HEAD/OPTIONS, never
includes `protected.conf`, strips external identity/Authorization headers, and proxies through the
Gateway Dapr identity. Apply the existing API rate limit and `streaming.conf`. Asset API serves it
only after opaque-ticket validation. Keep query strings out of access logs; the existing JSON
format's `$uri` field must remain unchanged.

- [ ] **Step 3: Validate routing policy and the built image**

Add the new script to the CI verify job, then run:

~~~bash
go test ./...
./scripts/test-auth-routing.sh
./scripts/test-www-routing.sh
./scripts/test-media-sync-routing.sh
docker build --build-arg "RELEASE=media-sync-local" -t api-gateway:media-sync .
~~~

Expected: route assertions and image build pass.

- [ ] **Step 4: Commit**

~~~bash
git add conf.d/common/media-cors.conf conf.d/default.conf conf.d/common/protected.conf conf.d/common/proxy.conf internal/verifier scripts/test-media-sync-routing.sh .github/workflows/ci.yml README.md
git commit -m "feat: route protected asset collections"
~~~

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
