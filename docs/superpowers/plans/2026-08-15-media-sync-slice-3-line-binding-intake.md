# Media Sync Slice 3: Helper Binding and Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authorized managers create and bind Asset API collections to registered helper LINE groups, then synchronize future eligible attachments through the existing durable scan pipeline without breaking `save_resource`.

**Architecture:** Keep the existing `helper` profile and Fastify process. A deterministic `/media-sync` public command binds a registered group with a one-time hashed code. Helper PostgreSQL owns only LINE binding/intake state; Asset API owns collection/asset state and Account API owns management permission. Automatic intake and `save_resource` converge on one canonical source identity and one Asset API asset before branching into collection and curated publications.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, existing attachment worker/outbox, LINE SDK/HTTP content streaming, Asset API, Account API, React/Vite Admin Console, Nginx/API Gateway, Vitest.

## Global Constraints

- Repositories:
  - `/Users/rayselfs/Projects/hhc/website/account-api`
  - `/Users/rayselfs/Projects/hhc/hhc-line-function-bot`
  - `/Users/rayselfs/Projects/hhc/website/admin-fe`
  - `/Users/rayselfs/Projects/hhc/website/api-gateway`
- Create one focused feature branch per repository from its current production branch.
- Modify `helper`; do not create a profile.
- `/media-sync` is a deterministic public command, not a function definition, function grant, or LLM route.
- A group must finish `/registry` before binding; rejected attempts do not consume the code.
- One active group binding maps to one collection and one collection to one active group.
- Managers and readers are independently authorized.
- Helper trusts `X-HHC-*` only after the existing Gateway/Dapr caller boundary.
- Codes are random, hashed, one-use, profile-scoped, valid for 60 minutes, and never logged.
- Webhook intake remains fast: commit durable work before the existing start-only Redis event claim,
  then reply 200 without downloading media.
- Automatic intake is silent on success/failure.
- Asset API remains the sole ClamAV boundary.
- One LINE message creates at most one canonical Asset API source asset.
- `line.group.file` and the current 25 MiB curated policy remain unchanged.
- With no active binding rows, deployment must be behaviorally inert.

---

## File Map

| Repository | File | Responsibility |
| --- | --- | --- |
| account-api | `internal/handlers/internal_permission_handler.go` | Bounded internal permission decision |
| account-api | `internal/handlers/internal_permission_handler_test.go` | Caller and RBAC decision tests |
| account-api | `internal/routes/routes.go` | Helper-only verifier route |
| line-bot | `src/media-sync/migrations.ts` | Binding, code, ingest, publication, and outbox schema |
| line-bot | `src/media-sync/store.ts` | Atomic binding/code/intake state |
| line-bot | `src/media-sync/service.ts` | Management and command orchestration |
| line-bot | `src/media-sync/http-routes.ts` | Admin Console management API |
| line-bot | `src/media-sync/intake.ts` | Deterministic webhook routing and canonical identity |
| line-bot | `src/media-sync/worker.ts` | Streaming validation, Asset API scan, and publication |
| line-bot | `src/attachments/scan-queue.ts` | Backward-compatible typed queue envelope |
| line-bot | `src/tools/run-attachment-asset-job.ts` | Dispatch existing or media-sync work |
| line-bot | `src/media-sync/unsend.ts` | Delete-wins tombstone handling |
| line-bot | `src/transport/line/public-access-commands.ts` | `/media-sync` command |
| line-bot | `src/transport/line/webhook-routes.ts` | Intake/unsend/leave placement |
| line-bot | `src/clients/asset-api.ts` | Collection and canonical asset operations |
| line-bot | `src/clients/line.ts` | Bounded content stream and transcoding status |
| line-bot | `src/account/account-admin-client.ts` | Permission decision call |
| admin-fe | `src/lib/media-sync-api.ts` | Same-origin management client |
| admin-fe | `src/pages/MediaSyncPage.tsx` | Collection/ACL/binding UI |
| admin-fe | `src/lib/access-control.ts` | `media-sync:manage` capability |
| admin-fe | `src/App.tsx` | Protected route |
| admin-fe | `src/components/AppLayout.tsx` | Navigation entry |
| api-gateway | `conf.d/default.conf` | Protected admin management routes |

### Task 1: Add a bounded internal permission verifier

**Repository:** `account-api`

**Files:**
- Create: `internal/handlers/internal_permission_handler.go`
- Create: `internal/handlers/internal_permission_handler_test.go`
- Modify: `internal/routes/routes.go`
- Modify: `internal/routes/routes_test.go`
- Modify: `cmd/main.go`

**Route:**

~~~text
POST /priv/account/v1/permissions/verify
caller: hhc-line-function-bot
request:  {"userId":"<uuid>","permission":"media-sync:manage"}
response: {"allowed":true}
~~~

- [ ] **Step 1: Add failing handler tests**

Cover direct user permission, role permission, wildcard permission, missing permission, disabled user, malformed UUID, unsupported permission, repository error, wrong Dapr caller, and the exact helper caller.

- [ ] **Step 2: Run focused tests**

~~~bash
go test ./internal/handlers ./internal/routes -run 'InternalPermission|PermissionsVerify' -count=1
~~~

Expected: compile/route failure.

- [ ] **Step 3: Implement one decision endpoint**

Inject the existing `RBACService` and call `HasPermission`. Allow only `media-sync:manage` in this endpoint; return one boolean, not roles or a permission dump. Protect the route with the existing internal-caller middleware restricted to `LineBotCallerAppID`.

- [ ] **Step 4: Validate**

~~~bash
gofmt -w internal/handlers/internal_permission_handler.go internal/handlers/internal_permission_handler_test.go internal/routes/routes.go internal/routes/routes_test.go cmd/main.go
go test ./internal/handlers ./internal/routes ./internal/services -count=1
go test ./...
~~~

- [ ] **Step 5: Commit**

~~~bash
git add internal/handlers/internal_permission_handler* internal/routes cmd/main.go
git commit -m "feat: verify bounded internal permissions"
~~~

### Task 2: Persist atomic bindings, codes, and canonical intake state

**Repository:** `hhc-line-function-bot`

**Files:**
- Create: `src/media-sync/types.ts`
- Create: `src/media-sync/migrations.ts`
- Create: `src/media-sync/store.ts`
- Create: `src/__tests__/media-sync-store.test.ts`
- Modify: `src/db/postgres.ts`
- Modify: `src/index.ts`
- Modify: `src/__tests__/runtime-composition.test.ts`

**Tables:**

- `media_sync_bindings` from the approved spec
- `media_sync_binding_codes` from the approved spec
- `media_sync_ingests(source_key, profile_name, message_id, group_id, collection_id, asset_id, state, display_name, media_kind, expected_mime, size_bytes, checksum_sha256, tombstoned_at, created_at, updated_at)`
- `media_sync_publications(source_key, publication_type, target_id, state, updated_at)`
- `media_sync_outbox(source_key, operation, attempts, available_at, claimed_until, completed_at, last_error_category)`

- [ ] **Step 1: Add failing migration and store tests**

Test:

1. code hashes only and 60-minute expiry;
2. a collection cannot have two simultaneously usable unexpired codes;
3. one active group and one active collection binding;
4. unregistered precheck can occur before `bindWithCode`;
5. invalid/expired/used/already-bound attempts do not overwrite;
6. code consume and binding insert are one transaction;
7. duplicate `source_key` reuses one ingest/work row;
8. tombstone wins over enqueue, retry, and publish state.

- [ ] **Step 2: Run focused tests**

~~~bash
pnpm vitest run src/__tests__/media-sync-store.test.ts
~~~

Expected: failure because media-sync store is absent.

- [ ] **Step 3: Implement in-code migrations**

Follow `src/access/migrations.ts` and existing PostgreSQL store conventions. Use partial unique indexes for active bindings, unique `source_key` for ingest, and `FOR UPDATE SKIP LOCKED` for outbox claims.

Reuse the invite-code generator/hash pattern from `registration-invite-code-store.ts`. Do not reuse its Redis/in-memory storage because binding creation must commit atomically with PostgreSQL.
Serialize code creation per profile/collection with a transaction-scoped PostgreSQL advisory lock,
then reject an existing unconsumed, unexpired code before insert. This keeps the table simple while
preventing concurrent usable codes.

- [ ] **Step 4: Compose the store once**

Create the store in the existing production runtime and pass it through `AppDependencies`. Do not add a factory interface with a single implementation; expose the concrete store methods needed by HTTP, command, and worker paths.

- [ ] **Step 5: Validate and commit**

~~~bash
pnpm vitest run src/__tests__/media-sync-store.test.ts src/__tests__/runtime-composition.test.ts
pnpm typecheck
git add src/media-sync src/db/postgres.ts src/index.ts src/__tests__/media-sync-store.test.ts src/__tests__/runtime-composition.test.ts
git commit -m "feat: persist LINE media sync state"
~~~

### Task 3: Add the helper management service and protected HTTP surface

**Repository:** `hhc-line-function-bot`

**Files:**
- Create: `src/media-sync/service.ts`
- Create: `src/media-sync/http-routes.ts`
- Create: `src/__tests__/media-sync-http.test.ts`
- Modify: `src/account/account-admin-client.ts`
- Modify: `src/__tests__/account-admin-client.test.ts`
- Modify: `src/clients/asset-api.ts`
- Modify: `src/__tests__/asset-api.test.ts`
- Modify: `src/config.ts`
- Modify: `src/__tests__/config.test.ts`
- Modify: `src/transport/line/webhook-routes.ts`
- Modify: `src/types.ts`
- Modify: `aca.containerapp.yaml`
- Modify: `src/__tests__/profile-config-deployment-contract.test.ts`

**Routes:**

- `GET /api/line/media-sync/collections`
- `POST /api/line/media-sync/collections`
- `PATCH /api/line/media-sync/collections/{collectionId}`
- `DELETE /api/line/media-sync/collections/{collectionId}`
- `POST /api/line/media-sync/collections/{collectionId}/acl`
- `DELETE /api/line/media-sync/collections/{collectionId}/acl/{aclId}`
- `POST /api/line/media-sync/collections/{collectionId}/binding-code`
- `DELETE /api/line/media-sync/collections/{collectionId}/binding`

- [ ] **Step 1: Add failing client tests**

Extend existing clients with exact Dapr calls for permission verification and Asset API collection
management, including helper-only `GET /priv/assets/collections` and
`GET /priv/assets/collections/{collectionId}`. Test request IDs, idempotency keys, status mapping,
timeouts, malformed responses, and secret-safe errors.

Add validated non-secret config defaults `ASSET_API_APP_ID=asset-api` and
`MEDIA_SYNC_GATEWAY_CALLER_APP_ID=api-gateway` to production composition/YAML. Management HTTP
routes trust normalized HHC headers only when the Dapr caller exactly matches that configured
Gateway app ID. Do not add Gateway to an admin/user allowlist.

- [ ] **Step 2: Add failing route tests**

Assert every route rejects:

- missing/wrong Gateway caller;
- missing `X-HHC-User-ID`;
- denied `media-sync:manage`;
- malformed input or missing idempotency key.

Assert a permitted manager can mutate/list collections without receiving collection media or gaining reader ACL.

- [ ] **Step 3: Implement the narrow management service**

The route order is:

1. authenticate exact Gateway workload caller;
2. read normalized HHC user ID;
3. call Account API `media-sync:manage` verifier;
4. call Asset API or helper binding store;
5. return a request-ID-bearing response.

Collection list for managers is the helper management list, not the reader endpoint. Return collection metadata, ACLs, and binding status only.

- [ ] **Step 4: Add binding-code safeguards**

Before issuing a code, fetch collection state from Asset API and reject missing/deleted/already-bound collections. Store only the hash. Return plaintext exactly once as:

~~~json
{"command":"/media-sync <code>","expiresAt":"<rfc3339>"}
~~~

- [ ] **Step 5: Validate and commit**

~~~bash
pnpm vitest run src/__tests__/account-admin-client.test.ts src/__tests__/asset-api.test.ts src/__tests__/media-sync-http.test.ts src/__tests__/config.test.ts src/__tests__/profile-config-deployment-contract.test.ts
pnpm lint
pnpm typecheck
git add src/media-sync src/account src/clients src/config.ts src/transport/line/webhook-routes.ts src/types.ts src/__tests__ aca.containerapp.yaml
git commit -m "feat: manage LINE media sync collections"
~~~

### Task 4: Route management through Gateway and add Admin Console UI

**Repositories:** `api-gateway`, then `admin-fe`

**Gateway files:**
- Modify: `conf.d/default.conf`
- Modify: `scripts/test-media-sync-routing.sh`

**Admin files:**
- Create: `src/lib/media-sync-api.ts`
- Create: `src/lib/media-sync-api.test.ts`
- Create: `src/pages/MediaSyncPage.tsx`
- Create: `src/pages/MediaSyncPage.test.tsx`
- Modify: `src/lib/access-control.ts`
- Modify: `src/lib/access-control.test.ts`
- Modify: `src/lib/admin-route-title.ts`
- Modify: `src/lib/admin-route-title.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/AppLayout.tsx`

- [ ] **Step 1: Add exact protected Gateway locations**

On the admin host only, route `/api/line/media-sync/` to `$line_bot_base` with `protected.conf`. Permit only the methods required above. The Gateway must clear external identity headers and set normalized `X-HHC-*` values plus its Dapr caller identity.

Validate with the repository's Nginx configuration check and commit:

~~~bash
./scripts/test-media-sync-routing.sh
docker build --build-arg "RELEASE=media-sync-admin-local" -t api-gateway:media-sync-admin .
git add conf.d/default.conf scripts/test-media-sync-routing.sh
git commit -m "feat: route media sync administration"
~~~

- [ ] **Step 2: Add failing Admin API/capability tests**

Add `media-sync:manage` to the existing capability union/catalog. Test 401 reauthentication, 403 forbidden, request ID propagation, idempotency headers, and typed collection/ACL/binding responses.

- [ ] **Step 3: Add failing page/route tests**

Test collection create/rename/delete, ACL user/role add/revoke, copyable standalone command, 60-minute expiry display, binding status refresh, and explicit unbind confirmation. A user without management permission must not see or open the route.

- [ ] **Step 4: Implement one focused page**

Reuse existing Admin layout, form, dialog, status badge, and error patterns. Do not add a file browser or media preview. The page manages folders and access; it never calls reader/content endpoints.

Reuse the existing Account Admin API user/role lookup and selectors for ACL subjects; do not add
free-form UUID/role-name entry or another account directory client.

- [ ] **Step 5: Validate and commit**

~~~bash
npm run test:run -- src/lib/media-sync-api.test.ts src/pages/MediaSyncPage.test.tsx src/App.test.tsx
npm run lint
npm run build
git add src
git commit -m "feat: add LINE media sync administration"
~~~

### Task 5: Implement deterministic `/media-sync` binding

**Repository:** `hhc-line-function-bot`

**Files:**
- Modify: `src/transport/line/public-access-commands.ts`
- Modify: `src/transport/line/webhook-routes.ts`
- Create: `src/__tests__/media-sync-command.test.ts`
- Modify: `src/__tests__/webhook-smoke.test.ts`

- [ ] **Step 1: Add the command matrix**

Test helper group success, unregistered group, direct chat, room, wrong profile, missing code, expired code, reused code, group already bound, collection bound elsewhere, group-name lookup failure, and two independent group/collection bindings.

Assert unregistered, already-bound, wrong-source, and collection-conflict paths leave the code unconsumed.
Group-name lookup failure is also retryable and leaves the code unconsumed.

- [ ] **Step 2: Run focused tests**

~~~bash
pnpm vitest run src/__tests__/media-sync-command.test.ts src/__tests__/webhook-smoke.test.ts
~~~

Expected: failure because the public command does not exist.

- [ ] **Step 3: Add command handling beside `/registry`**

Parse exact `/media-sync <code>` in `handlePublicAccessCommand`. Require:

1. profile name `helper`;
2. group source with group ID;
3. active group registration through the existing `AccessStore`;
4. no active group binding;
5. successful group display-name lookup through the existing LINE identity client;
6. successful atomic `bindWithCode` with that display name.

If group display-name lookup fails, return a temporary-failure reply and do not consume the code.

- [ ] **Step 4: Keep the function catalog unchanged**

Add an assertion that `media-sync` is absent from `FunctionName`, function definitions, grants, profile function lists, and LLM tool schemas.

- [ ] **Step 5: Validate and commit**

~~~bash
pnpm vitest run src/__tests__/media-sync-command.test.ts src/__tests__/function-definitions.test.ts src/__tests__/profile-config-validation.test.ts
pnpm typecheck
git add src/transport/line src/__tests__
git commit -m "feat: bind registered groups to media collections"
~~~

### Task 6: Converge automatic intake and `save_resource` on one durable asset

**Repository:** `hhc-line-function-bot`

**Files:**
- Create: `src/media-sync/intake.ts`
- Create: `src/media-sync/worker.ts`
- Create: `src/media-sync/content-file.ts`
- Create: `src/__tests__/media-sync-intake.test.ts`
- Create: `src/__tests__/media-sync-worker.test.ts`
- Modify: `src/attachments/asset-worker.ts`
- Modify: `src/attachments/scan-queue.ts`
- Modify: `src/attachments/scan-outbox.ts`
- Modify: `src/attachments/scan-worker-config.ts`
- Modify: `src/functions/attachment-entrance.ts`
- Modify: `src/functions/save-resource.ts`
- Modify: `src/functions/resource-binary-publisher.ts`
- Modify: `src/clients/line.ts`
- Modify: `src/clients/asset-api.ts`
- Modify: `src/transport/line/webhook-routes.ts`
- Modify: `src/tools/run-attachment-scan-job.ts`
- Modify: `src/tools/run-attachment-asset-job.ts`
- Modify: `aca.attachment-scan-job.yaml`
- Modify: `scripts/deploy-aca.sh`

**Canonical identity:**

~~~text
line:{profileName}:{messageId}
~~~

- [ ] **Step 1: Add routing and deduplication tests**

Cover the four routing rows from the spec: bound/unbound crossed with manual intent present/absent.
Assert webhook redelivery, PostgreSQL failure followed by LINE retry, concurrent automatic/manual
requests, and late manual confirmation result in one LINE download, one Asset API upload, one scan,
and one source asset. Assert the legacy webhook key is not claimed when the durable upsert fails.

- [ ] **Step 2: Add streaming worker tests**

Test LINE preparing/retry, 404, 410, transcoding failure, retry exhaustion, 200 MiB boundary, unsupported magic/MIME/extension combinations, safe fallback names, inactive binding, scan pending/clean/infected/failed, lease expiry, and idempotent replay.

- [ ] **Step 3: Record publications before returning from the webhook**

After signature plus existing access/registration filtering, and before the current
`webhookEventStore.tryStart` and LLM routing:

- ignore non-LINE content providers, text, stickers, locations, and bot-originated events;
- find an active binding;
- upsert the canonical ingest and requested `collection` publication;
- if the existing manual intent applies, attach the `curated` publication to the same ingest;
- enqueue one durable outbox row.

Only bound eligible messages take this pre-dedupe database path. Unbound behavior stays
byte-for-byte compatible with the existing path.

Start a bounded media-sync outbox dispatcher beside the existing attachment outbox dispatcher. It
publishes `{ kind: 'media-sync', workId }` to the same Azure queue only after PostgreSQL commit.
Keep `{ workId }` and `kind: 'attachment'` backward-compatible for existing queued messages.

- [ ] **Step 4: Stream to one bounded temporary file**

Extend the existing `createLineSdkContentClient` with a media-sync-only method that returns the
`@line/bot-sdk` Node `Readable` plus content type, before `readableToUint8Array`. Keep the existing
buffered method unchanged for the 25 MiB curated flow.

Use that stream with Node `fs/promises` and a `mkdtemp` directory. Stream to disk while
hashing/counting; abort above 200 MiB. Delete the temporary directory in `finally`. Do not put a
Buffer or bytes in PostgreSQL/Redis/queue payloads, and do not add a second raw LINE HTTP client.

- [ ] **Step 5: Reuse Asset API's scan pipeline**

Extend the existing Asset API client with `uploadFile(target, filePath)` using Node
`http`/`https` plus `createReadStream`/`pipeline`, while keeping the current Uint8Array upload method
for curated resources. Create one `line.group.media-sync` upload session with idempotency derived
from source key, stream the temp file, complete it, and wait using the existing finite
polling/worker mechanism. Add collection membership only after Asset API reports clean and ready.

Do not hold one job replica while scan remains pending. Persist `assetId` and stage
`awaiting-scan`, set bounded `available_at` backoff, acknowledge the queue message, and let the
PostgreSQL outbox dispatch the next stage. A later finite job reads Asset API once and either
reschedules, terminalizes, or publishes. Every stage rechecks tombstone/binding.

For a pending curated publication, pass the same clean asset/work artifact into existing `save_resource` metadata/confirmation/catalog publication. It may perform its existing OneDrive/catalog copy, but must not redownload LINE content, create another canonical asset, or run another scan.

- [ ] **Step 6: Preserve the 25 MiB curated ceiling**

Automatic collection intake accepts up to 200 MiB. If the same item also requests curated publication and exceeds `line.group.file` policy, collection publication may succeed while curated publication records a bounded policy rejection.

Add separate `MEDIA_SYNC_MAX_BYTES=209715200` to worker config/job YAML; do not change
`MAX_ATTACHMENT_BYTES=26214400`. Increase the event-job replica timeout to 1800 seconds for the
bounded LINE-to-temp-to-Asset upload stage, while keeping parallelism/max executions at 1 until pilot
metrics justify otherwise. Update deploy-script/YAML contract tests.

- [ ] **Step 7: Validate and commit**

~~~bash
pnpm vitest run src/__tests__/media-sync-intake.test.ts src/__tests__/media-sync-worker.test.ts src/__tests__/attachment-asset-worker.test.ts src/__tests__/attachment-asset-job.test.ts src/__tests__/attachment-scan-job.test.ts src/__tests__/attachment-scan-worker-config.test.ts src/__tests__/save-resource.test.ts src/__tests__/resource-binary-publisher.test.ts
pnpm lint
pnpm typecheck
git add src/media-sync src/attachments src/functions src/clients src/transport/line src/tools src/__tests__ aca.attachment-scan-job.yaml scripts/deploy-aca.sh
git commit -m "feat: ingest bound group media once"
~~~

### Task 7: Make unsend and LINE leave delete-wins

**Repository:** `hhc-line-function-bot`

**Files:**
- Create: `src/media-sync/unsend.ts`
- Create: `src/__tests__/media-sync-unsend.test.ts`
- Modify: `src/transport/line/webhook-routes.ts`
- Modify: `src/media-sync/store.ts`
- Modify: `src/media-sync/worker.ts`
- Modify: `src/clients/asset-api.ts`
- Modify: `src/functions/resource-binary-publisher.ts`

- [ ] **Step 1: Add race tests**

Test unsend before claim, while downloading, after upload/before scan, after collection publish, after curated publish, duplicate unsend, late worker completion, failed cleanup retry, and LINE leave.

- [ ] **Step 2: Route lifecycle events before ordinary message filtering**

Handle signed unsend/leave events before the current `allowEvent` message filtering and legacy
webhook claim. For unsend, derive the same canonical source key from `unsend.messageId` and
atomically tombstone/enqueue cleanup. For leave, disable the active `helper` group binding. Both
operations are PostgreSQL-idempotent and neither event enters the LLM path.

- [ ] **Step 3: Recheck tombstone at every commit boundary**

Worker checks before Asset upload completion, collection membership, and curated publication. Cleanup removes collection membership, revokes/removes derived publication through its current owner path, then owner-deletes the canonical Asset API asset. Retry each idempotently.

- [ ] **Step 4: Validate and commit**

~~~bash
pnpm vitest run src/__tests__/media-sync-unsend.test.ts src/__tests__/media-sync-worker.test.ts src/__tests__/webhook-smoke.test.ts
pnpm typecheck
git add src/media-sync src/transport/line/webhook-routes.ts src/clients/asset-api.ts src/functions/resource-binary-publisher.ts src/__tests__
git commit -m "feat: remove unsent synchronized media"
~~~

### Task 8: Close the helper/admin slice with end-to-end tests

**Repositories:** `hhc-line-function-bot`, `admin-fe`, `api-gateway`

- [ ] **Step 1: Run helper quality gates**

~~~bash
pnpm lint
pnpm typecheck
pnpm test
pnpm eval:kernel
pnpm build
~~~

- [ ] **Step 2: Run Admin Console quality gates**

~~~bash
npm run lint
npm run test:run
npm run build
~~~

- [ ] **Step 3: Run a local signed-webhook integration**

With test doubles/local services, prove:

1. manager without reader access creates a collection and ACL;
2. unregistered group cannot bind and code remains valid;
3. after `/registry`, `/media-sync` succeeds;
4. image/video/audio/file intake returns webhook 200 promptly;
5. only clean assets become collection members;
6. `save_resource` plus automatic intake produces one canonical asset;
7. unsend removes all publications;
8. a second group binds independently.

- [ ] **Step 4: Verify inert deployment**

Start the production composition against an empty binding table and run the existing webhook corpus. Assert no attachment behavior, replies, function availability, or profile configuration changes.

- [ ] **Step 5: Record the dependency chain**

Record Account API, Asset API prerequisite, Gateway, helper, and Admin Console commit SHAs/CI URLs. Do not create a real binding or assign production permissions in this slice.

## Slice Gate

- [ ] All four repositories pass their existing CI gates.
- [ ] Direct access to helper management routes without Gateway is rejected.
- [ ] Plaintext binding codes and content tickets are absent from logs, traces, audit rows, and error responses.
- [ ] `/media-sync` is absent from the function catalog and works only in registered `helper` groups.
- [ ] Existing `save_resource` tests and behavior remain intact.
- [ ] Empty binding state is inert.

## Rollback

- Remove the Admin Console navigation/route and Gateway management route first.
- Roll back helper application revisions; retain additive helper tables and disable active bindings before rollback.
- Collection assets remain in Asset API and can be cleaned by explicit owner operations after state reconciliation.
- Account API verifier can remain deployed but unreachable; removing the Gateway/helper caller path is sufficient to disable use.
