# Admin LINE Media Library Design

## Status

Approved Plan B design. This specification replaces the earlier read-only discussion draft.
Implementation planning must start from this version.

## Goal

Add an Admin media library where authorized managers can browse, search, preview, rename, download,
retain, and permanently delete media received from registered LINE groups. The library is the
control surface for content consumed by hhc-client-v2 and future platforms.

LINE groups remain the only upload source. Admin Console does not upload, move, or migrate media.

## Product Boundary

This is not the hhc-client-v2 File Explorer and does not reuse its React components, Zustand stores,
IndexedDB, Electron IPC, projection behavior, offline cache, favorites, or trash.

Admin receives a purpose-built, online-only, flat media library backed by the existing Asset API
collection, changes, content-ticket, and lifecycle contracts:

```text
Registered LINE group
  -> helper durable intake and malware scan
  -> Asset collection item
  -> Admin LINE media library
  -> hhc-client-v2 and future readers
```

Each Asset collection is one top-level media folder. There are no nested folders.

## Authorization Boundary

All Plan B Admin routes require the canonical Admin user and `media-sync:manage`. A manager does not
also need the reader role or a collection ACL to administer content. The existing public reader
surface remains independently protected by its global reader role and collection ACL.

Admin requests continue through the hhc-line-function-bot management facade. The facade validates
`media-sync:manage`, calls Asset API internal management routes, and never exposes internal Asset
IDs, Blob keys, storage URLs, LINE group IDs, or trust headers to the browser.

This boundary keeps administration separate from the public reader contract and avoids granting
managers an unrelated runtime reader role.

## Information Architecture

Keep the existing `LINE 媒體同步` collection configuration and binding flow. The collection edit
page contains two clear sections:

- folder settings: name, binding, ACL, and retention;
- media files: online browsing and management of the selected collection.

The media area defaults to files ordered by `createdAt` descending and loads additional cursor pages
on demand. The visible label for `createdAt` is `建立時間`.

## File Naming

LINE file messages retain their declared filename after basename and control-character validation.
Image, video, and audio messages normally have no source filename, so the existing intake-generated
name remains authoritative, for example:

```text
image-2026-08-18T06-30-00-000Z-a1b2c3d4.jpg
video-2026-08-18T06-30-00-000Z-a1b2c3d4.mp4
audio-2026-08-18T06-30-00-000Z-a1b2c3d4.m4a
```

The hash suffix prevents collisions. Duplicate display names are allowed within a collection because
LINE may legitimately send the same named file more than once. Item identity, not filename, drives
sync and mutations.

Rename changes only the basename. The extension is immutable and remains consistent with the
detected MIME type. Names are trimmed, limited to 255 bytes, and reject path separators and control
characters. Downloads use the latest collection item `displayName`, not the original Asset filename.

## View Modes and Selection

Provide the same four conceptual view modes as hhc-client-v2 without sharing its implementation:

- list;
- small icons;
- medium icons;
- large icons.

The selected mode is a browser-local Admin preference. Changing modes preserves the current item
selection.

Selection follows desktop file-manager behavior:

- plain click selects one item;
- Ctrl-click, or Cmd-click on macOS, toggles one item;
- Shift-click selects a contiguous range among currently loaded items;
- Space toggles the focused item;
- Enter opens the focused item in the viewer;
- clicking empty space clears selection.

Selection survives loading more results and is limited to 100 items. Shift selection never reaches
items that have not been loaded. There is no whole-collection selection mode.

## Thumbnail and Viewer Behavior

Do not generate or store thumbnails in the first release. Image and video cards use the original
content through short-lived item-scoped tickets and browser-native rendering:

- images use lazy `<img>` rendering;
- videos load only visible metadata and range data, seek to a static frame, remain paused, expose no
  controls or focus target, ignore pointer input, and are forced back to paused if playback starts;
- `IntersectionObserver` prevents off-screen cards from requesting content;
- any ticket, network, decode, seek, or codec failure falls back to the media-type icon.

This best-effort path avoids FFmpeg, derivative processing, extra Blob storage, and a second media
pipeline. Server-generated thumbnails are reconsidered only after measured Admin bandwidth or memory
problems.

A single-item viewer opens by double-click, Enter, or an explicit accessible preview action:

- image: browser-native image surface;
- video: browser-native video with playback controls only inside the viewer;
- audio: browser-native audio controls;
- PDF: browser-native PDF viewer with download fallback;
- unsupported types, including presentation files: metadata and download only.

Closing the viewer stops playback and discards its ticket URL and state. Ticket URLs are never stored
in browser persistence, caches, analytics, logs, or error payloads.

## Search and Rename

Search is server-side because permanent items make unbounded collection growth possible. It matches
the current `displayName` using case-insensitive substring semantics within one collection. Empty
search lists all items. Results retain `createdAt` descending order and cursor pagination.

The first release does not add a search engine or PostgreSQL extension. A bounded per-collection
substring query is sufficient until measurements prove otherwise.

Rename is single-item only. It increments the collection content revision and emits the current item
as an upsert. It does not change the Asset, Blob key, `createdAt`, content ETag, size, MIME type, or
source revision.

## Retention Policy

Each collection has an independent `retentionDays` value:

- default: 14 days;
- minimum: 1 day;
- maximum: 365 days;
- expiry: `createdAt + retentionDays * 24 hours`;
- changes apply retroactively to all existing non-exempt items.

The collection settings area shows the retention period. Individual files show `建立時間` but not a
derived expiry value. Reducing retention displays a warning that already-old items will be permanently
deleted by the next run and that permanently retained items are excluded.

Each item has a management-only `retentionExempt` boolean displayed as `永久保留`. Managers can set
or clear it for one or multiple selected items. Permanent retention prevents scheduled deletion but
does not prevent an explicit manager deletion.

There is no collection-level `forever` value, trash, restore, grace period, or undo.

## Asset Retention Worker

Asset API owns retention policy and deletion. Add a small `asset-retention-worker` executable that
runs daily at 03:00 Asia/Taipei and processes bounded batches of at most 100 expired collection items.
Actual deletion may occur up to approximately 24 hours after expiry.

The first worker sweep is `SweepExpiredCollectionItems`. Future Asset domains may add their own
candidate queries while reusing the job runner, retry, observability, deletion lifecycle, and Blob
purge. Do not create a rule engine, plugin system, or generic policy table before another concrete
retention policy exists.

The worker and Admin mutations use the same domain deletion primitive:

1. lock the collection and selected active item rows;
2. skip items whose `retentionExempt` committed first;
3. increment the collection revision once for the batch;
4. create one tombstone per deleted item;
5. make the items immediately unavailable to list, viewer, ticket redemption, and readers;
6. mark a `line.group.media-sync` Asset owned by the media-sync ingest deleted only when no active
   collection item still references it;
7. leave physical Blob and derivative deletion to the existing lifecycle worker.

The underlying Asset purge is asynchronous. Admin success means the collection occurrence is removed
and its content is unavailable, not that Blob deletion has already completed.

## Data Model

Add the minimum collection metadata required by the approved behavior:

```text
asset_collections.retention_days
  smallint not null default 14
  check 1 <= retention_days <= 365

asset_collection_items.retention_exempt
  boolean not null default false

asset_collection_items.updated_revision
  bigint not null, initialized from created_revision

asset_collection_items.updated_at
  timestamptz not null, initialized from created_at
```

Do not persist per-item `expiresAt`; it is derived. Do not add thumbnail or derivative metadata for
Plan B.

`retentionDays` and `retentionExempt` are management metadata and do not advance the reader-visible
collection revision. Rename and deletion do advance it.

## Management API Surface

Extend the existing Admin management facade with exact endpoints for:

- cursor-paginated item listing with optional filename query;
- collection retention update;
- single-item rename;
- batch set or clear permanent retention, maximum 100 items;
- batch permanent deletion, maximum 100 items;
- single content-ticket issuance for thumbnail and viewer;
- batch content-ticket issuance for multiple download, maximum 100 items;
- ticket content GET and HEAD with Range and conditional headers.

Managed item responses contain only:

```text
id
displayName
mimeType
sizeBytes
createdAt
retentionExempt
```

No response contains `assetId`, Blob key, storage URL, raw LINE identifier, or collection ownership
internals.

Batch retention updates and deletion are idempotent. Items already deleted by retention or another
request are successful no-ops. All active items deleted by one batch receive their own tombstone at
the batch revision.

## Download Behavior

Single download uses one short-lived content ticket. Multiple download requests one ticket for each
selected active item and triggers separate browser downloads from the same explicit user action.

Do not create ZIP archives. Chrome and comparable browsers may request site permission to download
multiple related files. If the browser blocks automatic downloads, Admin explains how to allow the
site permission and reports the successfully started and failed counts. There is no ZIP fallback.

## Reader and Client Synchronization

Retention metadata never appears in public collection responses. Readers continue to consume active
items and tombstones through the existing collection changes API.

Rename introduces an item update revision. Incremental changes emit the latest item as an upsert;
reset pages emit the current active snapshot. hhc-client-v2 receives the same remote item ID and
content identity, updates the visible filename, and preserves any downloaded Blob.

Manual and scheduled deletion emit identical tombstones. A client that is online applies the delta.
A long-offline client follows the existing reset-to-delta barrier and reconciles its local snapshot,
removing items no longer present.

## Concurrency and Failure Semantics

Admin and the retention worker lock the same collection item rows:

- if permanent retention commits first, the worker skips the item;
- if deletion commits first, later rename or retention mutation reports the item unavailable and the
  Admin view refreshes;
- explicit deletion ignores `retentionExempt`;
- content tickets are redeemable only while their exact item remains active, so deletion invalidates
  previously issued tickets immediately.

HTTP behavior:

- `400`: invalid name, extension change, retention bound, selection size, cursor, or query;
- `401`: use the existing single session refresh, then end the Admin session on repeated failure;
- `403`: do not reveal collection or item existence;
- `404`: treat as removed or unavailable and refresh the current result;
- `409`: use only for a genuine concurrent state conflict that cannot be treated as an idempotent
  no-op;
- `429`, `5xx`, or network failure: preserve the current list and selection and offer retry.

Viewer and thumbnail failures never fail the media list. They fall back to an icon or download action.

## Security

- Require `media-sync:manage` for every Admin media route.
- Keep content tickets item-scoped and no longer than five minutes.
- Recheck active collection, item, Asset state, and ETag at redemption.
- Preserve `private, no-store`, `no-referrer`, Range, ETag, and conditional request behavior.
- Sanitize filenames at ingestion and rename boundaries.
- Treat all LINE content as untrusted after malware scanning and use browser-native renderers without
  injecting file content into Admin HTML.
- Do not persist ticket URLs or content in Admin browser storage.

## Observability

Each retention run records a run ID and aggregate counts for scanned, deleted, exempt-skipped,
already-removed, and failed items, plus duration. Logs do not contain filenames, LINE group IDs, Blob
keys, or other content identifiers.

Expose at least:

- last successful retention run timestamp;
- expired candidate backlog;
- deleted item count;
- failed batch count;
- existing Blob purge backlog and failures.

The scheduled job may safely retry. Blob deletion failures remain isolated in the existing lifecycle
worker retry path.

## Rollout

Retention is retroactive, so production rollout is deliberately staged:

1. deploy schema, management API, Gateway routes, and Admin UI with the schedule disabled;
2. initialize existing collections to 14 days;
3. run a read-only preflight reporting candidate count and total bytes per collection, without names;
4. let managers adjust collection retention and mark required files permanent;
5. confirm the preflight and enable the daily schedule;
6. after the first run, verify tombstones, hhc-client-v2 reconciliation, ticket invalidation, Blob purge
   backlog, and worker metrics.

## Delivery Slices

### B1: Asset management contracts

- schema and constraints;
- managed item list and server search;
- rename update revision and changes upsert;
- batch permanent-retention and deletion primitives;
- manager content tickets and safe DTOs.

### B2: Admin media library

- retention settings;
- four view modes and accessible selection;
- filename search and extension-locked rename;
- direct lazy thumbnails and fallback icons;
- Image, Video, Audio, and PDF viewer;
- single and multiple download;
- single and batch permanent deletion.

### B3: Retention lifecycle

- asset-retention-worker and daily schedule;
- preflight mode;
- shared deletion-to-purge path;
- metrics, retry, and concurrency coverage;
- staged production enablement.

### B4: Consumer compatibility and release

- hhc-client-v2 rename-without-redownload regression coverage;
- tombstone and long-offline reset reconciliation;
- Gateway and production CSP/Range verification;
- live Admin preview, download, rename, delete, and retention smoke tests.

## Explicit Non-goals

- Admin upload, drag-and-drop, paste upload, or alternate ingestion.
- Nested folders.
- File move or migration.
- Custom sorting.
- ZIP download.
- Trash, restore, undo, or deletion grace period.
- Server-generated image or video thumbnails.
- Video playback from grid thumbnails.
- PPTX or office-document rendering.
- Projection, offline cache, favorites, or local file management.
- A generic retention rule engine or new media service.

## Verification Requirements

Backend and contract tests must cover:

- retention bounds, retroactive expiry, exemption, and exact boundary time;
- batch idempotency and manual/worker races;
- unreferenced Asset deletion and referenced Asset preservation;
- rename validation, duplicate names, change-feed upsert, and download filename;
- server search, cursor stability, safe DTO projection, and permission denial;
- content ticket expiry, deletion invalidation, Range, ETag, and HEAD.

Admin tests must cover:

- all four view modes preserving selection;
- plain, Ctrl/Cmd, Shift, Space, and Enter interaction;
- the 100-item limit and load-more selection behavior;
- search, rename, permanent retention, deletion confirmation, and retry states;
- image/video thumbnail fallback;
- Image, Video, Audio, and PDF viewer cleanup;
- multiple-download permission guidance and partial failures.

Consumer and release verification must prove:

- rename updates hhc-client-v2 without content re-download;
- manual and scheduled tombstones remove local content;
- reset reconciliation removes content for long-offline clients;
- production Gateway and CSP preserve inline content, Range, and no-store behavior;
- the first retention run matches its approved preflight.

## Acceptance Boundary

Plan B is complete only when managers can control the actual LINE media available to current and
future readers: search and rename it, inspect it safely, download one or many files, make selected
items permanent, delete one or many items irreversibly, and rely on each collection's bounded daily
retention policy without orphaning stored Blobs or stale client copies.
