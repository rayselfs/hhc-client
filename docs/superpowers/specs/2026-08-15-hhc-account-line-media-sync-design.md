# HHC Account and LINE Media Sync Design

## Status

Approved architecture, pending written-spec review on 2026-08-15.

This is the umbrella design for six independently verifiable delivery slices. Each slice receives
its own implementation plan after this document is approved. No slice may weaken the authorization,
scan, deletion, or dual-mode requirements defined here.

## Goal

Add HHC account login to LibrePresenter in Electron and browser mode, then let authorized users add
one or more read-only LINE media folders to File Explorer with the same folder-picker and offline
policy behavior as the existing OneDrive integration.

A registered LINE group binds to exactly one server-side media collection. Each collection binds to
at most one LINE group. A user can see a collection only when both conditions are true:

1. the user has the global `media_sync_user` role; and
2. an active collection ACL grants that user, or one of that user's roles, read access.

The person who creates or completes a LINE group binding does not need to be a LibrePresenter user
or a reader of the resulting collection.

## Non-goals

- Replacing the existing HHC IAM, API Gateway, asset scan pipeline, File Explorer database, or sync
  planner.
- Implementing OAuth Device Authorization Grant.
- Creating a second LINE profile or a second LINE Official Account for media sync.
- Making media sync an LLM function or feeding attachment content into the controlled agent.
- Backfilling media sent before a group binding became active.
- Synchronizing text messages, stickers, locations, contacts, or bot-generated messages.
- Implementing remote deletion of copies that were exported, copied to a normal local folder, or
  retained on a device while it remained offline.
- Building a complete Office-compatible presentation editor or changing the existing PPTX-to-
  editable conversion scope.
- Adding a new `media-sync-api` service in the first release.

## Current Constraints

### LibrePresenter

- The renderer must remain dual-mode: Electron uses preload IPC and browser mode uses web APIs.
- The projection entry is isolated from the control entry.
- File Explorer already has read-only sync records, tombstones, offline policies, download planning,
  resource cleanup, OneDrive import, and a provider-neutral `CloudFolderPickerDialog`.
- `SyncProviderType` currently supports `local-fs` and `onedrive` only.
- `ensureSyncItemAvailableForPresentation` currently dispatches directly to OneDrive.
- Browser downloads currently accumulate an entire response in memory before committing one Blob
  to IndexedDB. The advertised 2 GiB limit is not a reliable operational limit.
- Electron already owns the `librepresenter` custom protocol for OneDrive callbacks.
- The production bundle is near its current budgets. New account and sync code must be lazy-loaded
  and must not add an authentication SDK.

### HHC account

- `account-api` is the IAM authority. It issues credentials and owns users, roles, permissions,
  OAuth clients, sessions, and refresh-token rotation.
- API Gateway validates credentials and injects normalized identity headers. End services do not
  re-parse HHC JWTs.
- `account-api` already supports Authorization Code with PKCE.
- `hhc-desktop` uses `native_body`; `client-web` uses `browser_cookie`.
- `hhc-desktop` still has the obsolete `hhc://callback` redirect. The new desktop callback is
  `librepresenter://auth/account`.
- Browser token delivery returns an access token and keeps the refresh token in an HttpOnly cookie.

### Asset API

- `asset-api` owns uploads, Blob object keys, completion, scan state, derivatives, grants, byte-range
  downloads, and owner deletion.
- Existing restricted downloads authorize individual asset grants only.
- No collection or folder ACL exists.
- Existing `line.group.file` policy is the manually curated `save_resource` lane and remains capped
  at 25 MiB. Automatic media sync requires a separate namespace and policy.

### Helper LINE bot

- Only one LINE Official Account can be present in a group. Media sync therefore extends the
  existing `helper` profile; it does not create another profile.
- A group must complete `/registry <code>` before any managed group behavior is available.
- Existing `save_resource` requires requester-scoped intent and confirmation. Its durable outbox,
  attachment worker, ClamAV scan boundary, Asset API publisher, and idempotency patterns are reused.
- LINE webhook events can be redelivered. Event handling must be idempotent.
- LINE may return `202` while video or audio content is being prepared, and does not guarantee how
  long user content remains downloadable. Intake must be persisted and retried promptly.

## Selected Architecture

Use Asset API collections with dynamic collection ACLs. Helper owns LINE-specific binding and
attachment orchestration. Account API remains identity-only.

```text
Admin Console
  -> API Gateway / HHC account identity
  -> helper media-sync management API
       -> account-api permission verification
       -> asset-api internal collection management
       -> one-time binding challenge

Registered LINE group
  -> helper webhook /media-sync <code>
  -> helper binding store

LINE attachment
  -> deterministic helper intake
  -> shared durable attachment outbox and scan worker
  -> asset-api restricted asset
  -> asset-api collection membership

LibrePresenter Electron or browser
  -> HHC login
  -> asset-api authorized collection listing and change feed
  -> existing sync planner, local metadata, and offline policy
```

### Rejected alternatives

1. **Helper-owned ACL plus per-asset grants.** This duplicates every folder grant onto every asset.
   ACL changes require cross-service fan-out and cannot provide simple immediate revocation.
2. **A new media-sync service.** This creates another deployable, database, authorization client,
   and operational surface before the feature needs an independent scaling boundary.
3. **Account API folders.** Sync collections and LINE bindings are product data, not IAM data.
4. **Device flow.** Account API already supports PKCE, and both Electron and browser have a browser
   surface. Device flow would add protocol, UI, storage, expiry, and polling behavior without solving
   a current constraint.

### Repository ownership

| Repository | Responsibility in this design |
| --- | --- |
| `hhc-client-v2` | Electron/browser auth adapters, callback IPC, `hhc-line` sync provider, picker integration, local cleanup, and multimedia prerequisites |
| `account-api` | OAuth client redirect migration, `media_sync_user`, permissions, and bounded internal management authorization |
| `account-fe` | Existing interactive login/consent surface and allowlisted return to the HHC client OAuth request |
| `api-gateway` | Credential validation, normalized identity headers, and routes for client Asset API and helper management APIs |
| `asset-api` | Generic collections, collection ACL, restricted media namespace, scan-gated membership, content tickets, and range downloads |
| `hhc-line-function-bot` | Helper-only binding records/command, deterministic attachment intake, shared worker publication, and unsend |
| `admin-fe` | Collection, ACL, binding-code, binding-status, and unbind UI |

Existing infrastructure repositories change only where routes, workload caller allowlists, database
migrations, or production secrets/configuration require it. No repository receives a second auth
implementation or a duplicate binary ingestion path.

## Security and Authorization Model

### Global role and permissions

Add the following idempotent IAM records:

- role: `media_sync_user`
- permission: `media-sync:read`
- permission: `media-sync:manage`

`media_sync_user` includes `media-sync:read`. It is the global product gate, not a collection ACL.
`media-sync:manage` is not included in `media_sync_user`; it is assigned to administrators or a
delegated management role. A manager can create folders, edit ACLs, and create or revoke bindings
without gaining content read access.

Wildcard HHC administrators may manage the feature but do not bypass collection read ACLs.

### Collection ACL

An active read decision is:

```text
hasRole("media_sync_user")
AND
(
  acl(user, currentUserId, read)
  OR acl(role, anyCurrentRole, read)
)
```

Supported ACL subject types are `user` and `role`. The only first-release collection permission is
`read`. Binding a group does not create a reader ACL. Creating a collection does not automatically
grant the manager read access.

The gateway is the only externally reachable caller of authenticated Asset API collection routes.
Asset API accepts normalized `X-User-ID` and `X-Roles` only from that network boundary. It rejects
missing identity, missing `media_sync_user`, and unmatched ACLs with `403`.

### Management authorization

Admin Console calls helper's management API through API Gateway. Helper sends the normalized HHC
user identity to an internal Account API permission-verification endpoint. Account API evaluates
effective direct and role permissions and returns only an allow/deny decision for
`media-sync:manage`.

The internal verifier is callable only by the helper workload identity. It does not expose a general
permission dump. Helper calls Asset API collection-management routes using its existing workload
identity after authorization succeeds.

### Offline revocation limitation

Server authorization is checked on every list, delta, metadata, and content request. When an online
client receives `403` for an existing `hhc-line` root, it cancels downloads and purges that root's
local files, thumbnails, derived assets, and sync metadata.

An offline device cannot receive ACL revocation. Files already cached under `always-offline` remain
available until the app reconnects. This feature is offline synchronization, not DRM. Admin Console
must state this limitation when granting collection access.

## Authentication Design

### Shared renderer contract

LibrePresenter exposes one environment-selected auth adapter:

```ts
interface HhcAuthAdapter {
  getSession(): Promise<HhcSession | null>
  signIn(): Promise<void>
  getAccessToken(): Promise<string | null>
  signOut(): Promise<void>
  subscribe(listener: (session: HhcSession | null) => void): () => void
}

interface HhcSession {
  userId: string
  displayName: string
  roles: string[]
}
```

The adapter is a non-serializable service and belongs in a Context. Serializable display state may
be mirrored to Zustand but is never persisted. Tokens, authorization codes, PKCE verifiers, state,
and refresh credentials never enter Zustand, IndexedDB, or localStorage.

### Electron authorization

1. Main process creates a cryptographically random `state`, PKCE verifier, and S256 challenge.
2. Main stores the pending flow in memory with a five-minute expiry and allows one active flow.
3. Main opens the HHC authorization URL in the system browser with:
   - `client_id=hhc-desktop`
   - `redirect_uri=librepresenter://auth/account`
   - `response_type=code`
   - `code_challenge_method=S256`
   - `scope=openid profile`
4. The existing single-instance custom-protocol entrance routes the callback by exact scheme, host,
   and path. Unknown `librepresenter` URLs are rejected and never forwarded to OneDrive or account
   handlers.
5. Main verifies state, expiry, and single use, then exchanges the code with the verifier.
6. Main stores the refresh credential with Electron `safeStorage`. The renderer receives only
   session data and short-lived access tokens through narrow typed IPC.
7. Refresh rotation and sign-out happen in main. A refresh failure ends the HHC session and triggers
   account-scoped cleanup.

The OAuth client migration updates the existing row, not only the original seed insert. The obsolete
`hhc://callback` redirect is removed because no released LibrePresenter login flow uses it.

Electron windows deny unexpected top-level navigation. HTTP and HTTPS links continue to open in the
system browser through the existing external-link policy.

### Browser authorization

1. Browser creates state, PKCE verifier, and S256 challenge in memory.
2. Browser redirects to HHC authorization with:
   - `client_id=client-web`
   - `redirect_uri=https://client.alive.org.tw/oauth/callback`
   - `response_type=code`
   - `code_challenge_method=S256`
   - `scope=openid profile`
3. Callback verifies state and exchanges the code.
4. The access token remains in memory. Account API stores the rotating refresh token only in its
   Secure, HttpOnly cookie.
5. A page reload restores the session through the existing refresh/session endpoint. No refresh
   credential is accessible to JavaScript.
6. Browser calls authenticated collection endpoints with the in-memory access token through API
   Gateway.

### Logout and account switch

Logout and account switch use this order:

1. block new `hhc-line` refresh and download work;
2. cancel queued and active jobs for the old account's provider connections;
3. revoke/clear the HHC session;
4. purge only old-account `hhc-line` roots, items, blobs, thumbnails, derived assets, cursors,
   preferences, tombstones, and provider records;
5. leave local files, `local-fs`, OneDrive roots, and normal File Explorer folders untouched;
6. initialize the new account and import only collections visible to it.

Download commit performs a final provider/root/account authorization check so a late response cannot
recreate purged data.

## Asset Collection Model

Asset API adds generic collections. The schema and routes contain no LINE group identifiers.

### Tables

`asset_collections`

- `id`
- `namespace`
- `name`
- `revision` monotonic bigint, starting at 1
- `created_by_service`
- `created_by_subject`
- `created_at`
- `updated_at`
- `deleted_at`

`asset_collection_items`

- `collection_id`
- `asset_id`
- `remote_item_id`, stable within the collection
- `display_name`
- `source_revision`
- `created_at`
- `deleted_at`
- unique active membership on `(collection_id, asset_id)`
- unique identity on `(collection_id, remote_item_id)`

`asset_collection_acl`

- `id`
- `collection_id`
- `subject_type`: `user` or `role`
- `subject_id`
- `permission`: `read`
- `created_at`
- `revoked_at`
- one active row per `(collection_id, subject_type, subject_id, permission)`

Every item add, item tombstone, metadata change, ACL change, or collection delete increments the
collection revision in the same PostgreSQL transaction. The change cursor is an opaque encoding of
the last applied revision. A missing or invalid cursor causes a bounded full snapshot, not an error
that strands the local root.

### Internal management routes

Callable only by the helper workload identity:

- `POST /priv/assets/collections`
- `PATCH /priv/assets/collections/{collectionId}`
- `DELETE /priv/assets/collections/{collectionId}`
- `POST /priv/assets/collections/{collectionId}/acl`
- `DELETE /priv/assets/collections/{collectionId}/acl/{aclId}`
- `POST /priv/assets/collections/{collectionId}/items`
- `DELETE /priv/assets/collections/{collectionId}/items/{remoteItemId}`

All mutations require an idempotency key. Collection delete is soft delete and removes read access
immediately. Asset deletion remains a separate owner command.

### Authenticated reader routes

Exposed through API Gateway:

- `GET /api/assets/collections`
- `GET /api/assets/collections/{collectionId}/changes?cursor={opaque}`
- `GET /api/assets/collections/{collectionId}/items/{remoteItemId}`
- `POST /api/assets/collections/{collectionId}/items/{remoteItemId}/content-ticket`
- `GET /api/assets/collections/{collectionId}/items/{remoteItemId}/content`

Metadata and ticket creation use the normal bearer-authenticated gateway request. Ticket creation
returns an unguessable bearer URL scoped to the issuing subject, collection, item, and content
version. Its lifetime is at most five minutes and cannot exceed the current access-token expiry.
This is required because `<img>` and `<video>` cannot attach an Authorization header. The ticket
contains no filename or group ID, is excluded from application/access logs, and is never persisted
by the client. Because the URL is a short-lived bearer capability, clients set a no-referrer policy
and must not expose it in diagnostics.

The content route accepts either the normal bearer identity or the opaque ticket. It preserves ETag,
conditional requests, and byte ranges so videos can stream without first becoming an IndexedDB Blob.
Every request validates ticket integrity/expiry, content version, collection membership, current
collection state, and the collection ACL row matching the issuer identity or ticket role claims.
Collection ACL revocation therefore takes effect immediately. Account-role revocation takes effect
no later than the current access token and derived ticket expiry, matching the platform's existing
JWT revocation boundary. LibrePresenter renews an expiring ticket and resumes media at its prior
position when a long-running stream outlives the access-token window. Existing public and
grant-based download routes remain unchanged.

### Media-sync namespace

Add `line.group.media-sync` as a separate restricted Asset API namespace owned by
`hhc-line-function-bot`.

The first-release per-asset maximum is 200 MiB. The v1 allowlist is intentionally limited to formats
already classified by LibrePresenter:

- image: JPEG, PNG, GIF, WebP, and BMP;
- video: MP4, MOV, WebM, OGV, AVI, MKV, and WMV;
- audio: MP3, WAV, M4A, AAC, and OGG;
- document: PDF;
- presentation: PPTX and LPDeck.

The worker normalizes MIME aliases only after magic-byte/container validation and requires the
extension to match the validated format. SVG, legacy PPT, KEY, ODP, MPEG video, TIFF, HEIC, and HEIF
are rejected in v1. Platform-specific playback support remains client metadata: for example, a
browser may list an AVI or WMV item but disables presentation when its local capability probe fails.
The server does not silently transcode or relabel unsupported files.

`line.group.file` and its 25 MiB curated-resource policy remain unchanged.

## LINE Binding Design

### Binding records

Helper PostgreSQL owns:

`media_sync_bindings`

- `id`
- `profile_name`
- `group_id`
- `collection_id`
- `group_display_name`
- `bound_by_line_user_id`, nullable when LINE omits requester identity
- `binding_code_created_by_hhc_user_id`
- `bound_at`
- `disabled_at`
- one active binding per `(profile_name, group_id)`
- one active binding per `collection_id`

`media_sync_binding_codes`

- `id`
- `profile_name`
- `collection_id`
- `code_hash`
- `created_by_hhc_user_id`
- `expires_at`
- `consumed_at`
- `consumed_group_id`

Reuse the existing invite-code random generator and hashed-key pattern. A code is at least 12 URL-
safe characters, stored only as a hash, usable once, profile-scoped, and valid for 60 minutes. Code
creation and consumption are audited without recording the plaintext code.

### Admin Console flow

1. A user with `media-sync:manage` creates a collection in Admin Console.
2. The manager adds one or more user/role reader ACLs. This is independent from binding.
3. The manager requests a binding code for an unbound collection.
4. Admin Console displays a standalone copyable line:

   ```text
   /media-sync <code>
   ```

5. The manager or another person pastes that line into the target LINE group.
6. Admin Console polls or refreshes binding state and displays the group name after success.

The UI provides collection create/rename, ACL list/add/revoke, binding-code create, binding status,
and explicit unbind. It does not display or download media unless the current user also satisfies the
read decision.

Helper exposes the following gateway-authenticated management surface to Admin Console:

- `GET /api/line/media-sync/collections`
- `POST /api/line/media-sync/collections`
- `PATCH /api/line/media-sync/collections/{collectionId}`
- `DELETE /api/line/media-sync/collections/{collectionId}`
- `POST /api/line/media-sync/collections/{collectionId}/acl`
- `DELETE /api/line/media-sync/collections/{collectionId}/acl/{aclId}`
- `POST /api/line/media-sync/collections/{collectionId}/binding-code`
- `DELETE /api/line/media-sync/collections/{collectionId}/binding`

Each route verifies `media-sync:manage` before calling an Asset API or binding-store mutation.

### Group command flow

`/media-sync <code>` is a deterministic public command on `helper`, not an enabled function.

1. Reject direct chat and room sources; only LINE group sources are valid.
2. If the group is not registered, reply that `/registry <code>` must be completed first. Do not
   consume the media-sync code.
3. If the group already has a binding, reject replacement and leave the code unconsumed.
4. Atomically consume the code and create the binding. A collection already bound elsewhere is
   rejected.
5. Fetch the group display name through the LINE SDK and store only the operational metadata needed
   by Admin Console.
6. Reply with the bound folder name and state that only future eligible attachments are synchronized.

Rebinding requires explicit unbind in Admin Console followed by a new code. Unbind stops future
intake and does not delete the collection or existing assets. A LINE leave event disables the active
binding.

Multiple groups are supported by creating multiple collections and repeating the flow.

## Attachment Intake and Existing `save_resource`

### Routing decision

Attachment routing happens after LINE signature verification and webhook idempotency, before LLM
routing:

| Group state | Requester manual upload intent | Result |
| --- | --- | --- |
| unbound | absent | existing silent behavior |
| unbound | present | existing `save_resource` flow |
| bound | absent | automatic media-sync intake |
| bound | present | automatic intake plus curated metadata flow sharing one asset |

Automatic intake never grants `save_resource` authority and never publishes to the curated catalog
by itself.

Eligible message events are LINE-hosted `image`, `video`, `audio`, and `file` content with
`contentProvider.type=line` where that property applies. External provider URLs, text, stickers,
locations, and bot-originated messages are ignored. Image/video messages without a safe original
filename receive a deterministic display name derived from media type, event timestamp, and an
opaque message suffix.

### Shared identity and idempotency

The canonical source identity is:

```text
line:{profileName}:{messageId}
```

Helper stores one ingest record and one durable work item per source identity. Automatic sync and
manual `save_resource` attach their desired publications to that record. Concurrent delivery,
webhook redelivery, or manual confirmation cannot create a second download, Asset API upload, scan,
or source asset.

### Worker flow

1. Webhook transaction records source identity, group binding, collection ID, message type, and
   durable outbox work. It returns promptly.
2. The existing finite attachment worker claims the work with its bounded lease.
3. For video/audio content still preparing, the worker checks LINE transcoding state and retries with
   bounded backoff. `404`, `410`, failed transcoding, expiry, and retry exhaustion become terminal
   intake failures.
4. Worker streams content into a bounded temporary file while calculating size and SHA-256. It does
   not buffer the content in the webhook process or queue payload.
5. Worker rejects content above 200 MiB, unsupported magic/MIME/extension combinations, unsafe file
   names, or a source whose binding is no longer active.
6. Worker scans the file using the existing validated ClamAV signature snapshot.
7. A clean file is uploaded through one `line.group.media-sync` Asset API upload session and added to
   the bound collection using idempotency keys derived from source identity.
8. If a manual publication is pending, it references the same asset after its existing purpose,
   title, confirmation, and catalog rules succeed. The curated publisher may create its existing
   OneDrive/catalog publication once from the clean work artifact, but it does not download from
   LINE again, rescan, or create a second canonical Asset API source.
9. Infected, failed, expired, or rejected content is never added to the collection.

Success is silent in group chat. Binding success is replied to immediately; asynchronous intake
status belongs in Admin Console and LibrePresenter sync health so automatic sync does not create
group noise or consume push quota for every file.

### Unsend

An unsend event is keyed by the same source identity:

- before worker completion: mark the ingest tombstoned and prevent publish;
- after publish: remove collection membership, revoke manual/derived publication, owner-delete the
  source asset, and emit a collection tombstone;
- on clients: the next delta removes the local item, thumbnails, derived assets, and unreferenced
  source blob through existing reference-counted cleanup.

Unsend deletion wins over retries and late worker completion. Every commit boundary rechecks the
tombstone.

## LibrePresenter Sync Provider

### Provider identity

Add `hhc-line` to `SyncProviderType`. A provider connection is account-scoped and contains only:

- HHC user ID
- Asset API collection ID
- collection display name
- server revision/cursor metadata
- creation and last-refresh timestamps

It never stores an HHC refresh token.

### Folder picker

Reuse `CloudFolderPickerDialog`. Add an HHC LINE provider adapter that lists only collections
authorized for the current account. Selection remains single-folder. Users add multiple LINE groups
by reopening the same dialog, matching OneDrive behavior.

No separate LINE-specific picker, tree control, or multi-select workflow is introduced.

### Refresh and presentation availability

The existing sync planner consumes Asset API snapshots/deltas and maps:

- collection ID to `remoteFolderId`;
- collection item `remoteItemId` to sync item identity;
- asset checksum/ETag to content identity;
- collection tombstones to existing deletion cleanup.

Replace OneDrive-only presentation availability dispatch with the existing provider boundary. The
`hhc-line` provider uses the same `presentation`, `manual`, and `background` queue priorities.

Queue cancellation is added at the shared queue, not in the LINE adapter, so OneDrive unlink also
benefits from the fix.

### Offline policy

- `online-only`: metadata is synchronized; the adapter obtains an in-memory content ticket and uses
  its byte-range URL without creating a local source Blob.
- `on-demand`: presentation/manual selection downloads content when within local cache policy.
- `always-offline`: background queue downloads every eligible item when within storage policy.

Electron stores downloads through the existing native filesystem path.

Browser defaults new HHC LINE roots to `online-only`. Browser may cache a file only when it is at
most 256 MiB and projected storage remains below the existing 80% quota threshold. The browser does
not advertise 2 GiB offline support. OPFS streaming is deferred until measured usage proves that
offline browser files above 256 MiB are required.

### ACL loss and root cleanup

Any authenticated list, delta, or download `403` marks the root `access-revoked`, stops its queue,
and launches the same root-scoped purge used by logout. The root disappears from File Explorer after
cleanup. A transient `401` first attempts one auth refresh; a second `401` ends the HHC session.

Normal network errors remain retryable and do not delete cached data.

## Multimedia Stabilization Prerequisites

The following verified branch findings are prerequisites because login/sync would otherwise amplify
them:

1. Add provider/root/account cancellation and a pre-commit authorization check to the shared sync
   download queue.
2. Replay the latest projection snapshot when blank or blackout is cleared so native and VLC video
   resume from authoritative playback state.
3. Add typed VLC start/runtime error propagation to operator readiness/recovery UI.
4. Bound PDF projection rendering to the current/adjacent page in single mode and a virtualized,
   bounded canvas cache in continuous mode.
5. Stop advertising TIFF, HEIC, and HEIF as native without a successful decoder probe.
6. Remove the hard-coded 16:9 wrapper from image, video, and PDF projection surfaces; preserve source
   aspect ratio within the full output viewport.
7. Move read-only PPTX workspace layout onto the existing responsive primitives.
8. Keep new auth and provider code lazy-loaded so current bundle budgets remain green.

Application signing and macOS notarization are production-release prerequisites for distributing an
auth-enabled desktop build, but do not block local development or integration tests.

## Error Handling

### Authentication

- Unknown callback route, state mismatch, expired flow, reused code, and missing verifier fail closed
  without changing the current session.
- Refresh failure ends the session and performs account-scoped cleanup.
- Browser refresh-cookie failure redirects to login only after local provider work is blocked.

### Binding

- Unregistered group: instruct `/registry`; code remains valid.
- Invalid/expired/used code: generic invalid-code reply; do not disclose collection identity.
- Already-bound group or collection: reject without replacement.
- Asset API unavailable during code creation: no code is issued for a collection whose state cannot
  be verified.
- Binding-store failure after code consumption must be atomic; consumption and binding creation use
  one PostgreSQL transaction or one store operation with equivalent semantics.

### Intake

- LINE `202`: retry transcoding readiness with bounded backoff.
- LINE `404`/`410`: terminal `source-unavailable`.
- Oversize/unsupported/magic mismatch: terminal `rejected`.
- Scan infected/failed: terminal and unavailable to clients.
- Asset/collection transient failure: retry with the same idempotency key.
- Unsend: terminal tombstone that prevents every later publish step.

### Client sync

- `401`: refresh once, then end session.
- `403`: revoke and purge only the affected `hhc-line` root.
- `404` item: apply remote tombstone.
- storage limit: retain metadata and expose `insufficient-storage`.
- cancellation: resolve as cancelled, not retryable failure, and never recreate a sync entry.

## Observability and Audit

Record bounded, privacy-safe events for:

- login start/success/failure by client and environment;
- collection create/rename/delete and ACL add/revoke;
- binding code create/consume/expire and binding enable/disable;
- intake queued/downloading/waiting-for-transcode/scanning/published/rejected/deleted;
- sync refresh, access revocation, cancellation, purge, and storage failure;
- VLC runtime start failure and replay recovery.

Telemetry uses HHC request IDs, opaque collection IDs, work IDs, and categorized outcomes. It must
not record access/refresh tokens, authorization codes, PKCE verifiers, binding codes, raw group IDs,
raw LINE user IDs, file contents, or raw filenames.

Security and management mutations are audited with actor identity and target opaque IDs. Read access
logs remain sampled operational telemetry rather than an unbounded audit ledger.

## Testing Strategy

### LibrePresenter

- Auth adapter contract tests for Electron and browser.
- Exact custom-protocol routing, invalid state, flow expiry, refresh rotation, and renderer token-
  isolation tests.
- Browser callback/reload tests proving refresh credential is never in web storage.
- Shared queue cancellation tests covering queued, active, late web response, late Electron response,
  unlink, logout, account switch, and ACL revoke.
- `hhc-line` provider snapshot/delta/tombstone/401/403/storage tests.
- Generic folder picker tests proving single selection and multiple imports by reopening.
- Browser streaming and 256 MiB offline-limit tests.
- Projection tests proving VLC blackout resume, runtime failure visibility, bounded PDF canvases,
  source-aspect rendering, and responsive read-only PPTX layout.

### Account API and Account frontend

- Migration tests for role, permissions, role-permission link, and exact desktop redirect.
- Authorization Code + PKCE tests for both clients and token-delivery modes.
- Internal `media-sync:manage` verification tests for direct permission, role permission, wildcard,
  missing permission, inactive user, and unauthorized workload caller.
- Account frontend integration test proving HHC client authorization returns only to an allowlisted
  redirect.

### Asset API

- Collection transaction, revision, cursor fallback, idempotency, ACL, soft delete, and membership
  tests.
- Reader authorization matrix for global role, user ACL, role ACL, manager-only user, revoked ACL,
  deleted collection, and forged/missing identity headers.
- Conditional/range content tests through collection authorization.
- Namespace MIME, magic, size, scan, and owner-deletion tests.
- PostgreSQL integration tests for uniqueness and concurrent revision changes.

### Helper and Admin Console

- `/media-sync` tests for registered/unregistered/direct/room/already-bound/expired/reused codes.
- Multiple-group tests proving one group per collection and independent bindings.
- Permission tests proving a manager can bind without read access.
- Webhook redelivery and auto/manual concurrency tests proving one source asset.
- Video/audio transcoding retry, source expiry, oversize, scan failure, stale worker lease, and
  binding-disabled-during-work tests.
- Unsend-before-publish and unsend-after-publish deletion tests.
- Admin UI tests for collection, ACL, copyable command, binding status, unbind, and read isolation.

### End-to-end acceptance

1. Manager without `media_sync_user` creates a collection, grants A read access, and creates a code.
2. Unregistered group cannot bind; after `/registry`, `/media-sync <code>` succeeds.
3. A logs into Electron, adds the LINE folder through the generic picker, and receives a clean image,
   video, PDF, and PPTX sent after binding.
4. B has `media_sync_user` but no ACL and cannot list or fetch A's collection.
5. Granting B ACL makes the collection visible after refresh; revoking it purges B's online root.
6. A second group binds a second collection and both appear independently when A is authorized.
7. A bound-group manual `save_resource` request and automatic intake produce one Asset API asset.
8. LINE unsend removes the server asset publications and local synchronized copy.
9. Browser login, picker, online streaming, projection popup, and account-scoped logout cleanup work
   without persisting refresh credentials.
10. VLC playback resumes from the authoritative position after blackout.

## Delivery Slices and Gates

### Slice 0: Multimedia stabilization

Deliver the eight client prerequisites. Gate on focused tests, full Vitest, lint, typecheck,
production build/bundle budgets, browser E2E, native binding check, and packaged projection smoke in
CI.

### Slice 1: HHC authentication

Deliver IAM migrations, OAuth redirect, callback router, Electron secure token storage, browser
adapter, and account UI. Gate on OAuth contract tests and both environment login/logout flows. No
media role is assigned in production yet.

### Slice 2: Asset collections and ACL

Deliver Asset API schema, internal management, reader routes, namespace, range streaming, and API
Gateway routes. Gate on PostgreSQL integration and authorization matrix tests. No group binding is
active yet.

### Slice 3: Helper binding and intake

Deliver management API, Admin Console UI, `/media-sync`, binding store, deterministic intake,
shared-publisher deduplication, and unsend. Gate on signed webhook, queue/scan, and binding E2E. With
no binding records, deployment is inert.

### Slice 4: LibrePresenter HHC LINE provider

Deliver picker/provider integration, snapshot/delta/download behavior, offline policies, ACL purge,
and account-switch cleanup. Gate on Electron, browser, and cross-account E2E.

### Slice 5: Pilot and production release

Assign `media_sync_user` and ACLs only to pilot accounts, bind one pilot group, verify image/video/
PDF/PPTX, unsend, revocation, scan health, storage, and observability. Complete desktop signing and
macOS notarization before general auth-enabled desktop distribution.

Each service follows its existing PR-to-main CI/CD boundary. Do not deploy unmerged local commits.
Production role assignment and the first real group binding are explicit rollout actions, not part of
schema deployment.

## Acceptance Criteria

The design is complete when all of the following are true:

- Electron and browser use HHC Authorization Code + PKCE with the specified token boundaries.
- No refresh credential is readable by renderer JavaScript or stored in browser/local app databases.
- `media_sync_user` gates the feature, while collection ACL independently limits visible folders.
- Managers can bind groups without becoming readers.
- `/media-sync` works only in a registered helper group and cannot overwrite an existing binding.
- One group maps to one collection; multiple independent bindings are supported.
- Eligible post-binding media uses the existing durable scan boundary and one source asset per LINE
  message.
- Existing `save_resource` behavior remains intact and shares the same source asset when both paths
  apply.
- Unsend prevents future use and removes existing synchronized/manual/derived publications.
- LibrePresenter reuses the existing picker, sync records, offline policies, planner, cleanup, and
  presentation readiness paths.
- A user cannot list, fetch, or retain an online cache for another user's collection without ACL.
- Logout/account switch deletes only old-account `hhc-line` data.
- Browser mode can stream large media without materializing the whole file in memory.
- Multimedia stabilization, service tests, browser E2E, and packaged desktop gates pass before the
  pilot binding is enabled.
