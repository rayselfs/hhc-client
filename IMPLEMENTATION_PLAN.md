# HHC Client Implementation Plan

## Scope

This plan covers five related feature groups:

1. Shared media capability, background job, and derived-asset infrastructure.
2. File Explorer upload, naming, rename, thumbnail, and Presenter UI fixes.
3. Extended video compatibility through controlled transcoding.
4. Read-only local and OneDrive directory synchronization.
5. Presentation readiness and storage management.

Each phase must be implemented, tested, and committed independently. Transcoding and synchronization
must not start as full implementations until their feasibility and data-model phases pass review.

## Implementation Status

This document is now reconciled against the current `feat/media-projection` branch. The detailed
phase text below is retained as design context, but the actionable remaining work should be read from
this status table first.

| Area                                                        | Status    | Evidence / Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0A: Media Capability Registry                         | Completed | Implemented by `7122fc9 refactor: centralize media capability detection`.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Phase 0B: Persistent Media Jobs and Derived Assets          | Completed | Implemented by `9fc755f feat: add persistent media jobs and derived assets` and `f165f39 feat: add media derivative lifecycle`. Future job types may extend the same foundation, but the planned foundation exists.                                                                                                                                                                                                                                                                            |
| Phase 1A: Canonical File Classification and Upload Pipeline | Completed | Implemented by `622a2ef fix: unify file classification and upload pipeline`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Phase 1B: Naming, Folder Conflicts, and Inline Rename       | Completed | Implemented by `3e9d267 fix: prevent file and folder naming conflicts`, with later inline-rename timing refinements.                                                                                                                                                                                                                                                                                                                                                                           |
| Phase 1C: Presenter UI Corrections                          | Completed | Implemented by `61c6bb8 fix: refine presenter grid and media controls` and later video/PDF control fixes through `97861ba feat: refine media presenter controls and preferences`.                                                                                                                                                                                                                                                                                                              |
| Phase 2A: Video Transcoding Feasibility Spike               | Completed | Implemented by `d523278 docs: evaluate extended video transcoding`. Decision: Electron-only transcoding; Web transcoding remains skipped.                                                                                                                                                                                                                                                                                                                                                      |
| Phase 2B: Transcoding Data Model and Job Lifecycle          | Completed | Implemented by `f165f39 feat: add media derivative lifecycle`.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Phase 2C: Electron Native Transcoding                       | Completed | Implemented by `e72e678 feat: configure user ffmpeg for transcoding`, `4234a78 feat: transcode unsupported video in electron`, and `ee31e21 fix: prefer transcoded video derivatives for playback`.                                                                                                                                                                                                                                                                                            |
| Phase 2D: Web Transcoding                                   | Skipped   | Explicitly out of scope after Phase 2A. Web remains limited to browser-native media and the existing 2 GiB product limit.                                                                                                                                                                                                                                                                                                                                                                      |
| Phase 3A: Sync Schema and Provider Contracts                | Completed | Implemented by `27d6793 feat: add sync provider data model`.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Phase 3B: Electron Local Folder Provider                    | Completed | `055846b feat: add local sync folder ipc` covers the IPC/foundation, `47fd333 fix: harden local sync folder scanning` adds connection-ID validation plus resilient scans for symlinks, permission loss, and missing descendants, and `130192e feat: watch local sync folders` adds main-process watcher status, debounce, overflow rescan state, and large-file metadata verification.                                                                                                         |
| Phase 3C: OneDrive Authentication and Provider              | Completed | Implemented by `ec358b4`, `4d360a5`, `8576e27`, `b15b17d`, `a8ea0a0`, `a717a84`, and `2389ac8`. OneDrive remains one-way/read-only.                                                                                                                                                                                                                                                                                                                                                            |
| Phase 3D: Read-Only UI, Projection Locks, and Unlink        | Completed | Read-only helpers and mutation protection exist via `f7b4eb8` and `f09e44b`; projection locks exist via `1cbc573`; remove-from-app unlink orchestration exists via `40e9139 feat: unlink synced folders from app`; `65e1cd4 feat: convert synced folders to local files` adds keep-files conversion; `4dc5ee5 feat: show synced file offline states` adds offline-state UI; `066fae0 fix: recover pending sync cleanups on startup` adds restart cleanup recovery.                             |
| Phase 4A: Presentation Readiness and Rehearsal              | Completed | `ac0cc66 feat: add presentation readiness checks` adds readiness analysis foundation, `f48faf8 feat: gate media presentation by readiness` adds a readiness-gated start helper that excludes unavailable items and preserves snapshot identities, `e4cbf72 fix: route media starts through readiness gate` wires File Explorer and Header presentation entry points through the gate, and `a803df0 feat: add media presentation rehearsal mode` adds rehearsal mode plus readiness summary UI. |
| Phase 4B: Storage Management Dashboard                      | Completed | `6539c4a`, `055a643`, `fd8bb81`, and `4f93b90` add accounting, usage UI, cleanup, and integrity scanning foundations; `1d6e1b8 feat: evict regenerable media cache by budget` adds LRU eviction for regenerable derived assets while respecting projection locks; `8acc7c9 feat: export redacted media storage diagnostics` adds diagnostics export foundation; `cd40ec4 feat: clear unpinned sync media cache` adds sync-cache eviction and dashboard action.                                 |
| Preferences Integration                                     | Partial   | Media preferences are now split into subitems by `97861ba feat: refine media presenter controls and preferences`. FFmpeg, OneDrive, and storage sections exist. LAN Remote preferences remain roadmap-bound and are intentionally not implemented yet.                                                                                                                                                                                                                                         |
| Roadmap R1: Recovery Center                                 | Roadmap   | Not implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Roadmap R2: LAN Mobile Remote Control                       | Roadmap   | Not implemented. Scope remains LAN-only.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Remaining Non-Roadmap Work

Before saying the implementation plan is "roadmap only", finish or explicitly defer these
non-roadmap items:

1. Run the full quality gate after the remaining non-roadmap implementation commits:
   `npm run lint`, `npm run typecheck`, `npx vitest run`, and `npm run build`.

Roadmap work remains limited to Recovery Center and LAN Mobile Remote Control for the currently
approved scope.

## Execution Rules

- Work on `feat/media-projection`; do not commit directly to `main`.
- Preserve Electron and Web behavior unless a phase explicitly defines a platform-specific path.
- Keep Electron uploads in native filesystem storage and Web uploads as IndexedDB Blobs.
- Keep the Web upload product limit at 2 GiB, with an additional storage quota preflight.
- Do not reintroduce unconditional PDF.js, speech, Transformers, or FFmpeg loading at startup.
- Do not use filesystem paths as media identities or expose raw paths to the renderer.
- Use canonical UUID Blob IDs for all native files.
- Keep media capability decisions in one registry rather than duplicating MIME or extension checks.
- Run long-lived import, thumbnail, transcode, and sync work through one persistent job system.
- Treat generated thumbnails and transcoded media as derived assets with a shared lifecycle.
- OneDrive synchronization is one-way and read-only: remote changes flow into the app, but app
  mutations are never uploaded to OneDrive.
- Every user-configurable behavior in this plan must identify its Preferences location, persistence
  owner, default value, validation, and platform visibility.
- Every phase requires focused tests before its Conventional Commit.
- Run the complete quality gate after all phases:

```bash
npm run lint
npm run typecheck
npx vitest run
npm run build
```

---

## Phase 0A: Media Capability Registry

Create a shared capability registry as the single source of truth for media support:

```ts
type MediaSupportMode = 'native' | 'transcode-required' | 'unsupported'
type ThumbnailStrategy = 'image' | 'video' | 'pdf' | 'none'

interface MediaCapability {
  kind: 'image' | 'video' | 'pdf' | 'document'
  extensions: string[]
  canonicalMimeType: string
  aliases?: string[]
  thumbnail: ThumbnailStrategy
  web: MediaSupportMode
  electron: MediaSupportMode
}
```

- Resolve capability from normalized MIME type first, then extension fallback.
- Keep browser-playable and Electron-playable support explicit rather than assuming every `video/*`
  value is playable.
- AVI, MKV, and WMV resolve from the same registry, but platform policy differs:
  - Web: `unsupported`, because Web transcoding is not part of the approved implementation.
  - Electron: `transcode-required`, because the native FFmpeg flow can prepare compatible MP4
    derivatives.
- Derive upload filtering, canonical MIME metadata, icons, thumbnail eligibility, presentability, and
  transcode requirements from the registry.
- Keep protocol MIME validation separate from capability lookup; the registry may provide a
  canonical value only after a managed media ID is authorized.
- Reject conflicting extension or MIME registrations during tests.
- Do not add plugin-style runtime registration in this phase; use a static typed registry.

### Verification

- Test recognized MIME, empty MIME, generic MIME, mixed-case extension, aliases, and unsupported
  files.
- Test that upload, thumbnail, Presenter, and transcoding decisions return the same capability.
- Test Web/Electron differences without mutating global registry state.

Commit:

```text
refactor: centralize media capability detection
```

---

## Phase 0B: Persistent Media Jobs and Derived Assets

### Persistent job system

Add one persistent queue for long-running media work:

```ts
type MediaJobType = 'import' | 'cover-thumbnail' | 'pdf-pages' | 'transcode' | 'sync-download'
type MediaJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'blocked'
  | 'failed'
  | 'completed'
  | 'cancelled'

interface MediaJobRecord {
  id: string
  type: MediaJobType
  sourceBlobId?: string
  itemId?: string
  priority: number
  status: MediaJobStatus
  progress?: number
  attempt: number
  blockedReason?: 'configuration' | 'authentication' | 'storage' | 'offline'
  errorCode?: string
  createdAt: number
  updatedAt: number
}
```

- Persist jobs in IndexedDB and add an explicit schema migration.
- Restore interrupted jobs after restart; convert stale `running` jobs back to a recoverable state.
- Support enqueue, deduplication, priority boost, retry, cancellation, and bounded concurrency.
- Use `blocked` for work that can resume after configuration, authentication, storage, or network
  conditions change. Do not count blocked jobs as failed attempts.
- Define per-job concurrency:
  - import: existing upload concurrency
  - cover thumbnail: bounded parallel work
  - PDF page rendering: `1`
  - transcode: `1` by default
  - sync download: `2`
- Priority boost reorders pending work and does not interrupt active work unless that job type
  explicitly supports cancellation.
- Use explicit job ownership:
  - Renderer owns the persistent IndexedDB job record, scheduling policy, progress shown to the user,
    and recovery decision.
  - Electron main process owns native import streams, FFmpeg child processes, native downloads,
    temporary files, and process-local cancellation handles.
  - Renderer dispatches native work through typed IPC using a job ID and receives validated progress
    and terminal events.
  - Main process never marks a persistent job completed directly; renderer commits the terminal
    record only after validating the main-process result.
  - On startup, renderer reconciles stale jobs with main-process temporary-file/job status before
    retrying or cleaning them.
- Do not store non-serializable handles in IndexedDB.
- Expire completed/cancelled job history after a documented retention period.

### Generalized derived assets

Add a shared derived-asset registry:

```ts
type DerivedAssetKind =
  | 'cover-thumbnail'
  | 'pdf-page-thumbnails'
  | 'video-poster'
  | 'transcoded-video'

interface DerivedAssetRecord {
  id: string
  sourceBlobId: string
  kind: DerivedAssetKind
  storage: 'indexed-db' | 'native-fs'
  mimeType: string
  size?: number
  status: 'building' | 'ready' | 'failed'
  createdAt: number
  updatedAt: number
}
```

- Add a unique lookup on `[sourceBlobId, kind]`, except where a kind explicitly supports variants.
- Copies share generated assets through canonical `sourceBlobId`.
- Preserve optional item-level custom cover overrides separately by `itemId`.
- Resolve cover thumbnails consistently:
  1. use an item-level custom cover override keyed by `itemId` when present
  2. otherwise use the generated cover asset keyed by canonical `sourceBlobId`
  3. otherwise show the media-type fallback icon or pending state
- Migrate existing cover thumbnails and PDF page thumbnails without deleting usable legacy cache.
- All derived assets use temporary output and atomic completion where applicable.
- Final source Blob deletion removes every derived asset through the common cleanup service.
- Projection locks defer cleanup of any active source or derived asset.
- Failed or cancelled jobs must not leave usable-looking partial asset records.

### Verification

- Test schema migration, restart recovery, deduplication, priority, retry, cancellation, and retention.
- Test copied items sharing generated assets while custom cover overrides remain item-specific.
- Test final-reference cleanup for every derived asset kind.
- Test that failed jobs and interrupted migrations leave no orphan files or records.

Commit:

```text
feat: add persistent media jobs and derived assets
```

---

## Phase 1A: Canonical File Classification and Upload Pipeline

### File classification

Use the Phase 0A registry to expose a canonical renderer classification result:

```ts
interface ClassifiedFile {
  kind: 'image' | 'video' | 'pdf' | 'document' | 'unsupported'
  mimeType: string
  extension: string
}
```

- Prefer a recognized `File.type`, using the registry alias map.
- Fall back to the registry's case-insensitive extension lookup when `File.type` is empty or generic.
- Normalize supported image, video, PDF, and office-document MIME types before metadata is saved.
- Use the same helper for:
  - upload filtering
  - `FileItemRecord.mimeType`
  - thumbnail eligibility
  - PDF page thumbnail generation
  - Presenter eligibility
  - media protocol `Content-Type`
- Keep the existing explicit browser-playable video MIME allowlist. AVI, MKV, and WMV are rejected
  in Web mode and classified as Electron-only `transcode-required` video.

### Unified upload entry point

- Route file input, folder input, drag-and-drop, and `FileUpload.tsx` through `uploadFiles()`.
- Remove duplicate thumbnail eligibility logic from `FileUpload.tsx`.
- Apply the Web 2 GiB limit consistently to every upload entry point.
- Before a Web upload, use `navigator.storage.estimate()` when available and reject uploads that
  clearly exceed available quota.
- Electron continues importing every new file into native filesystem storage regardless of size.
- Metadata must only be created after native import or IndexedDB Blob persistence succeeds.

### PDF thumbnail queue

- Enqueue PDF page rendering through the Phase 0B job system with concurrency `1`.
- Queue only full-page PDF thumbnail generation; normal image/video/cover thumbnail work retains its
  existing upload concurrency.
- Ensure queue release occurs in `finally`.
- Do not call `loadPdfjsLib()` during app startup or generic route prefetch.
- PDF.js may be prefetched only from explicit PDF intent, such as selecting a PDF upload or opening a
  PDF preview.

### Verification

- Empty MIME PDF, image, and browser-playable video files receive canonical MIME metadata.
- Empty MIME PDF files are presentable and generate cover/page thumbnails.
- Unsupported extensions remain unsupported.
- All upload entry points enforce the same Web and Electron storage rules.
- Multiple PDF uploads render page thumbnails serially.
- Timer-only cold start does not request PDF.js.

Commit:

```text
fix: unify file classification and upload pipeline
```

---

## Phase 1B: Naming, Folder Conflicts, and Inline Rename

### Shared naming rules

- Move `resolveUniqueName()` and `resolveUniqueFileName()` out of `FilesPage.tsx` into a small naming
  helper module rather than coupling them to upload orchestration.
- Normalize comparisons with `trim()` and locale-independent case folding.
- Preserve the original display casing of accepted names.
- Define file-name splitting behavior:
  - `photo.jpg` -> base `photo`, extension `.jpg`
  - `archive.tar.gz` -> base `archive.tar`, extension `.gz`
  - `.env` -> base `.env`, no extension
- Reject empty names, whitespace-only names, path separators, `.` and `..`.

### Folder upload conflict handling

- Extend folder upload orchestration with access to existing child-folder names.
- Reserve names from both the destination folder and the current upload batch.
- Apply auto-rename at every directory level:

```text
Folder
Folder 2
Folder 3
```

- Handle case-insensitive conflicts.
- Prevent parallel uploads from silently creating duplicate sibling names. Recheck at the store or
  database write boundary before insertion.

### Folder creation and rename

- Block duplicate sibling folder names, excluding the folder currently being renamed.
- Apply the same normalization used by folder upload.
- Show `fileExplorer.folderAlreadyExists`.

### File inline rename

- Change only the file context-menu action from `edit` to `rename`.
- Keep folder editing in `FolderModal`.
- Add a shared `InlineRenameInput` component used by both Grid and List views.
- Preserve the existing file extension and edit only the base name.
- Support:
  - Enter to submit
  - Escape to cancel
  - blur to submit once
  - IME composition without premature submission
  - case-only rename
- Block duplicate sibling file names, excluding the current item.
- Show `fileExplorer.fileAlreadyExists`.

### Slow-click behavior

Trigger rename only when:

- both clicks target the same already-selected item
- the interval is between 500 ms and 1200 ms
- neither click uses modifier keys
- no drag or pointer movement occurred
- the interaction was not a native double-click

Reset the click state when selection, item, drag state, or view changes.

### Verification

- Test naming helpers, dotfiles, multi-extension names, invalid names, and case-insensitive conflicts.
- Test two uploads with the same root folder and nested folder names.
- Test simultaneous conflict recheck behavior.
- Test Grid and List rename with Enter, Escape, blur, and IME composition.
- Test that dragging and double-click opening do not trigger rename.

Commit:

```text
fix: prevent file and folder naming conflicts
```

---

## Phase 1C: Presenter UI Corrections

### Presenter Grid

- Limit the Presenter grid to six columns by removing `xl:grid-cols-8`.
- Resolve Grid and Next Preview thumbnails through the shared cover resolver:
  - item-level custom cover by `item.id`
  - generated cover by canonical `blobId`
  - fallback label/icon when neither exists
- Migrate legacy item-keyed generated thumbnails to the canonical Blob-derived asset without breaking
  copied items during the transition.
- Do not replace Grid thumbnails with full media files or PDF page-thumbnail arrays.

### Image zoom viewport

- Remove `transition-all duration-100` from the draggable viewport indicator.
- Retain transitions for non-drag state only if they do not interpolate live pointer coordinates.

### Video controls

- Replace seek `mouse` handlers with pointer handlers.
- Capture the pointer on `pointerdown`.
- Commit the seek and release capture on `pointerup`.
- Restore a non-dragging state on:
  - `pointercancel`
  - `lostpointercapture`
  - component unmount
- Check `hasPointerCapture()` before release.
- Keep keyboard range-input behavior functional.
- Render Play/Pause and Volume buttons in fixed `44px` square containers with centered circular
  styling.

### Verification

- Add Presenter Grid column and thumbnail-source regression tests.
- Add pointer-up-outside, pointer-cancel, lost-capture, keyboard seek, and unmount tests.
- Manually verify image viewport dragging and video controls in Electron and Web.

Commit:

```text
fix: refine presenter grid and media controls
```

---

## Phase 2A: Video Transcoding Feasibility Spike

This phase produces a documented prototype and measurements, not production integration.

### Input matrix

Test representative AVI, MKV, and WMV files with:

- H.264, HEVC, MPEG-4 Part 2, and WMV video where available
- AAC, MP3, AC-3, and unsupported audio combinations
- short, long, low-resolution, and high-resolution samples

### Electron spike

- Evaluate user-managed FFmpeg executables for macOS arm64, macOS x64, and Windows x64.
- Confirm supported minimum version, startup latency, throughput, CPU use, temporary disk use, and
  license/documentation obligations.
- Compare common static and system-installed builds without assuming a fixed installation path.
- Use `spawn(executable, args)` with an argument array and `shell: false`.

### Web spike

- Evaluate `@ffmpeg/ffmpeg` with current CSP and deployment headers.
- Measure browser memory, startup download, processing time, and storage use.
- Determine whether `SharedArrayBuffer` and cross-origin isolation are required and deployable.
- Treat 500 MB as a hypothesis, not a guaranteed threshold.

### Decision gate

Document one of:

1. Electron and Web production implementation.
2. Electron implementation with a smaller Web limit.
3. Electron-only transcoding with a clear Web unsupported-file message.

No production dependency is added until this decision is approved.

Commit:

```text
docs: evaluate extended video transcoding
```

---

## Phase 2B: Transcoding Data Model and Job Lifecycle

Phase 2A decision: implement Electron-only transcoding through a user-managed FFmpeg executable.
Web upload and sync must reject formats that require transcoding.

### Platform-aware import policy

- Keep one media capability registry, not separate Web/Electron extension whitelists.
- Web upload, drag-and-drop, folder upload, and sync import accept only `native` capabilities.
- Electron upload, drag-and-drop, folder upload, and sync import accept `native` and
  `transcode-required` capabilities.
- File input accept attributes must follow the same policy:
  - Web includes browser-native media only and must not include `video/*` or transcode-only
    extensions.
  - Electron includes transcode candidates such as `.avi`, `.mkv`, and `.wmv`.
- Unsupported document formats stay unsupported until a separate document conversion feature exists.

### Derivative records

Do not use `${originalBlobId}-transcoded` as an ID. Native media IDs must remain UUIDs.

- Extend the Phase 0B derived-asset registry with the `transcoded-video` implementation rather than
  creating a separate derivative store.
- Store transcode job state in the persistent job system and completed output metadata in the
  derived-asset registry.
- Add codec, container, dimensions, duration, and profile metadata needed to validate and reuse an
  output.
- Use the deterministic compatibility profile `mp4-h264-aac-yuv420p-faststart` for the first
  production implementation.
- Deduplicate jobs by source Blob identity and selected transcode profile.
- Copies share the same derivative through `sourceBlobId`.
- A derivative does not need a separate item-level ref-count.

### Job lifecycle

- Implement transcode-specific progress, cancellation, retry, crash recovery, and stale
  temporary-file cleanup through the common job system.
- Write output to a temporary file and atomically rename only after successful validation.
- Validate that output is playable MP4 before marking the derivative ready.
- Detect insufficient disk or browser quota before starting.
- On final source Blob deletion, delete derivatives through the common resource cleanup transaction.
- Projection locks postpone source and derivative cleanup until presentation releases them.

### Verification

- Test schema migration and legacy records.
- Test Web rejection and Electron acceptance for transcode-required extensions across file input,
  direct upload, folder upload, drag-and-drop, and sync import policy.
- Test job deduplication across copied items.
- Test cancellation, failed jobs, restart recovery, atomic completion, and final-reference deletion.
- Test that every native derivative ID passes native media ID validation.

Commit:

```text
feat: add media derivative lifecycle
```

---

## Phase 2C: Electron Native Transcoding

### Main-process service

- Do not package FFmpeg inside the application.
- Let the user select an existing FFmpeg executable from Preferences > Media > Video Transcoding.
- Open the native file picker from the main process and return only sanitized validation results to
  the renderer.
- Resolve the selected executable with `realpath`, validate the resolved target, and store the
  resolved executable path so replacing a symlink cannot silently change the program being executed.
- Persist the selected executable path in main-process configuration, not the renderer Zustand store
  or IndexedDB.
- The renderer may display the executable basename, detected version, readiness, and last validation
  result, but not require or depend on the raw path.
- Revalidate the configured executable at application startup and before each transcode job.
- Run `ffmpeg -version` with a short timeout and validate:
  - selected path is an absolute regular file
  - file is executable on macOS/Linux or has a valid Windows executable extension
  - process starts without shell invocation
  - detected version meets the documented minimum
  - required demuxers, decoders, encoders, and MP4 muxer are available
- Validate one deterministic compatibility output profile:
  - container: MP4
  - video: H.264
  - audio: AAC
  - pixel format: `yuv420p`
  - web optimization: `faststart`
- Prefer `libx264` when available. A hardware or alternative H.264 encoder may be accepted only after
  a capability probe confirms the required pixel format, MP4 output, and playback regression matrix.
- If no compatible H.264 encoder or AAC encoder is available, report the executable as missing
  required capabilities rather than producing a different output format silently.
- Never accept an executable path from arbitrary renderer text input or remote/LAN commands.
- Never search the current project directory or media directory for an executable automatically.
- Validate IPC sender and runtime payloads.
- Limit simultaneous background transcodes to `1` by default.
- Expose typed IPC for start, cancel, retry, status, and progress subscription.
- Ensure application shutdown terminates child processes and removes temporary files.

### Preferences

Add a dedicated section under `Preferences > Media > Video Transcoding`:

- current status: `Not configured`, `Ready`, `Invalid`, `Missing`, or `Unsupported version`
- detected FFmpeg version
- detected H.264/AAC capability and selected compatibility encoder
- selected executable basename
- **Select FFmpeg** action
- **Validate again** action
- **Remove configuration** action
- a short platform-specific installation guide and an external link to FFmpeg installation
  documentation
- a warning that FFmpeg is third-party software and is not downloaded or updated by HHC Client

- Selecting a new executable must validate it before replacing the current valid configuration.
- Removing the configuration cancels queued transcodes but must not delete completed MP4 derivatives.
- If the executable disappears or becomes invalid, mark queued jobs as blocked rather than failed and
  surface a Recovery Center action to select FFmpeg again.
- Web mode does not show the native executable selector.

### Playback behavior

- Prefer the completed static MP4 derivative through `hhc-media`.
- Allow transcode-required files to be imported when FFmpeg is not configured, but mark preparation
  as job status `blocked` with reason `configuration` and provide a direct link to the Video
  Transcoding preference section.
- Existing ready MP4 derivatives remain playable even when FFmpeg is later removed or invalid.
- If immediate playback is retained, implement it as a separate reviewed feature:
  - bind only to `127.0.0.1`
  - use an ephemeral port and unguessable session token
  - authorize only active managed media IDs
  - apply restrictive response headers
  - stop the server and child process on exit or cancellation
- Never run immediate and background transcodes for the same Blob simultaneously.
- When switching from an immediate stream to the static derivative, preserve current time, play/pause
  state, mute state, and volume.
- Disable seeking only while the stream genuinely cannot satisfy seek requests.

### Verification

- Test IPC authorization, invalid executable selection, directory selection, symlink behavior,
  unsupported version, validation timeout, command injection attempts, cancellation, app shutdown,
  and temporary-file cleanup.
- Test that renderer state, diagnostics, LAN remote snapshots, and logs do not expose the raw FFmpeg
  path.
- Test startup and pre-job revalidation when the executable is moved, removed, or replaced.
- Test that replacing FFmpeg configuration is atomic and preserves the previous valid configuration
  when validation fails.
- Test deterministic MP4/H.264/AAC/yuv420p/faststart output with every accepted encoder path.
- Test copied files sharing one transcode.
- Test source/derivative deletion in both deletion orders.
- Test large files without full-file ArrayBuffer creation.
- Package and smoke-test signed/notarized macOS and signed Windows artifacts without bundled FFmpeg.

Commit:

```text
feat: transcode unsupported video in electron
```

---

## Phase 2D: Web Transcoding

Skipped by Phase 2A decision. Web transcoding is not part of the approved roadmap because it adds
large WASM assets, CSP/cross-origin isolation constraints, high memory pressure, and a second
execution path for a lower-quality result. Web remains limited to browser-native media plus the
existing 2 GiB product limit.

Do not implement these items unless a future plan explicitly reopens Web transcoding:

- Lazy-load all FFmpeg WASM assets only after explicit user action.
- Enforce the measured size and memory limit from the feasibility spike.
- Perform storage quota preflight for both source and derivative.
- Run jobs in a dedicated Worker.
- Support cancellation, retry, progress, page reload recovery, and cleanup.
- Keep FFmpeg assets out of PWA precache unless a documented bundle-budget exception is approved.
- Provide an Electron recommendation when the file exceeds the supported Web threshold.

Commit:

```text
feat: transcode supported video files on web
```

---

## Phase 3A: Sync Schema and Provider Contracts

### Data separation

Do not store credentials, delta links, or volatile runtime state directly in `FolderRecord`.

Extend folders only with stable linkage:

```ts
interface FolderSyncLink {
  providerConnectionId: string
  remoteFolderId: string
  providerType: 'local-fs' | 'onedrive'
  offlinePolicy?: 'online-only' | 'on-demand' | 'always-offline'
}

interface SyncEntryPreference {
  providerConnectionId: string
  remoteItemId: string
  offlinePolicyOverride?: 'online-only' | 'on-demand' | 'always-offline'
}
```

Add separate stores for:

- provider connections
- sync cursors/delta links
- sync entries and remote identity
- per-entry offline policy overrides
- tombstones/deferred cleanup

Use the Phase 0B persistent job store for sync downloads rather than creating another download-job
schema.

Runtime states such as `syncing`, progress, and transient errors belong in the sync store, not folder
domain records.

For OneDrive, `offlinePolicy` is a local caching preference only. It must never be written back to
the remote provider.

### Provider interface

Define a provider contract for:

- connect/disconnect
- initial scan
- incremental changes
- metadata lookup
- content download
- cursor persistence
- retry classification

Use separate responsibilities:

- Electron local filesystem provider in the main process.
- Renderer window owns OneDrive popup authentication, PKCE initiation, MSAL/browser auth cache, and
  user-visible connection lifecycle.
- A Web Worker handles OneDrive delta pagination, metadata processing, and Web content downloads
  after receiving short-lived authorized request capability from the renderer.
- Electron main process owns protected refresh credential storage and native streaming downloads.
- Electron native download/storage service for large OneDrive files.

### Migration and rollback

- Add IndexedDB schema migrations with fixtures for existing databases.
- Preserve all legacy folders and file records.
- A failed migration must not partially create sync links.
- Define downgrade/feature-disable behavior for unfinished sync jobs.

Commit:

```text
feat: add sync provider data model
```

---

## Phase 3B: Electron Local Folder Provider

### Security and validation

- Select directories through a main-process dialog; do not expose arbitrary absolute paths to the
  renderer.
- Store an opaque provider connection ID in renderer-visible records.
- Reject duplicate, parent, child, and equivalent canonical paths.
- Resolve symlinks before nesting and sensitive-directory checks.
- Block system roots and configurable sensitive directories.
- Validate IPC sender and every provider operation.

### Synchronization behavior

- Perform initial scanning and filesystem watching in the main process.
- Define behavior for:
  - symlinks
  - permission loss
  - renamed files and folders
  - watcher overflow
  - removable and network volumes
  - application restart
- Use stable filesystem identity when available; otherwise document rename heuristics.
- Debounce event bursts and fall back to a bounded rescan after watcher overflow.
- Stream copied content into managed native storage; never load an entire large file over IPC.

### Verification

- Test traversal, symlink escape, nested links, sensitive paths, permission changes, watcher overflow,
  rename, disconnect, and restart recovery.
- Test large files without renderer ArrayBuffers.

Commit:

```text
feat: sync local folders in electron
```

---

## Phase 3C: OneDrive Authentication and Provider

### OAuth

- Use OAuth 2.0 Authorization Code with PKCE and validate `state`.
- Ship one HHC-managed default Azure Application Client ID.
- Allow the user to override the Client ID in `Preferences > Media > OneDrive`.
- Treat the Client ID as public application configuration, not a secret.
- Validate the override format before saving it and provide **Restore default Client ID**.
- Provide setup instructions listing the exact supported redirect URIs and required public-client
  configuration for a custom Azure application.
- Changing Client ID requires confirmation, disconnects current OneDrive connections, clears their
  auth sessions, and requires fresh sign-in. It must not delete already cached media automatically.
- Use supported redirect URIs rather than assuming `http://localhost/`.
- Web popup communication must validate origin and state.
- Electron authentication uses a managed temporary window and strict navigation/redirect validation.
- Popup creation and PKCE completion stay in the renderer/window authentication service; they are not
  delegated to a Web Worker.

### Preferences

Add `Preferences > Media > OneDrive`:

- effective Client ID source: `HHC default` or `Custom`
- custom Client ID input
- **Restore default Client ID**
- connection status and connected account
- sign in, reauthenticate, and disconnect actions
- default offline policy: `Online only`, `On demand`, or `Always available offline`
- sync cache budget
- active polling behavior summary

- The default Client ID is used when the custom value is empty.
- Client ID and non-sensitive preferences use the shared settings persistence adapter.
- Tokens and refresh credentials never enter the settings store.
- Web and Electron show the same effective Client ID but use their platform-specific credential
  storage.

### Credential storage

- Do not describe encrypted IndexedDB tokens as secure storage.
- Web uses the selected Microsoft authentication library cache strategy and documents residual XSS
  risk.
- Electron stores refresh credentials through `safeStorage` or an OS credential store.
- Renderer records contain only opaque connection IDs.
- Never log access tokens, refresh tokens, authorization codes, or PKCE verifiers.

### Delta synchronization

- Treat OneDrive as a one-way remote source:
  - remote create, rename, move, update, and delete are reflected locally
  - local sync-folder changes are blocked rather than uploaded
  - no upload, remote rename, remote move, or remote delete API is included in the provider contract
- Persist opaque delta links separately from folders.
- Follow pagination until the delta response completes.
- Handle token expiry, revoked consent, delta reset, `Retry-After`, exponential backoff, and jitter.
- Pause when offline and trigger an immediate bounded sync when connectivity or focus returns.
- Polling intervals are defaults, not fixed guarantees:
  - active: 30 seconds
  - burst: 10 seconds for up to 2 minutes
  - inactive: 3 to 5 minutes

### Downloads

- Limit concurrent downloads to `2`.
- Priority boost reorders pending work but does not interrupt an active download unless cancellation is
  explicitly supported.
- Electron downloads stream to native temporary files followed by atomic rename.
- Web downloads enforce both the 2 GiB product limit and available storage quota.
- Verify content length when available and clean up failed partial downloads.

### Offline availability

Support three OneDrive folder policies:

1. **Online only**
   - Synchronize metadata and folder structure.
   - Download content only for an explicit preview, presentation preparation, or copy-out action.
   - Cached content may be evicted when it is not locked or referenced.
2. **On demand**
   - Synchronize metadata immediately.
   - Download when the user opens, presents, rehearses, or explicitly requests a file.
   - Keep recently used content according to the sync-cache budget and LRU policy.
3. **Always available offline**
   - Recursively enqueue all supported files in the linked folder.
   - New and changed remote files are automatically downloaded.
   - Successfully downloaded content is pinned and excluded from automatic cache eviction.

- The linked folder defines the default policy and descendants inherit it.
- Store individual file and subfolder overrides in the per-entry preference store keyed by provider
  connection and immutable remote item ID.
- Allow an individual file or subfolder to override the inherited policy.
- Changing to `always-offline` shows required/available storage before queueing downloads.
- Changing away from `always-offline` removes the pin but does not immediately delete valid cached
  content; normal cache eviction may reclaim it later.
- A manual **Free up space** action removes unneeded cached content but preserves remote metadata.
- A manual **Download now** action raises the relevant pending jobs' priority.
- Electron stores offline content in managed native storage.
- Web stores offline content in IndexedDB and must request persistent browser storage when supported.
- If Web quota is insufficient, keep affected entries remote-only and report them individually rather
  than partially marking the folder offline-ready.

### Remote update behavior

- Track OneDrive files by immutable remote item ID, not name or path.
- If a cached remote file changes:
  - download the replacement to temporary storage
  - validate the completed content
  - atomically switch the local sync entry to the new Blob identity
  - retain the old Blob while projection locks or active snapshots reference it
- If a remote file is renamed or moved without content changes, update metadata without downloading
  it again.
- If a remote file is deleted, create a tombstone and defer physical cleanup while it is actively
  presented.
- Offline policy changes and cache eviction never modify or delete the OneDrive source.

### Offline status

Expose folder and item status separately:

- `remote-only`
- `queued`
- `downloading`
- `available-offline`
- `outdated`
- `failed`
- `insufficient-storage`

A folder marked `always-offline` is considered complete only when every eligible descendant is
`available-offline`. Show partial completion and failed-item counts.

### Verification

- Test the built-in Client ID, valid custom override, invalid override, restore-default action, and
  reconnect requirement after Client ID changes.
- Test that custom Client ID setup errors identify missing redirect URI or public-client
  configuration without exposing OAuth payloads.
- Test renderer-owned popup/PKCE flow, Worker delta processing, Electron protected credential
  storage, and native streaming downloads independently.
- Test that tokens never enter the settings store, Worker persistence, diagnostics, or logs.
- Test per-entry offline overrides by immutable remote item ID across rename and move operations.
- Test one-way behavior by asserting that no OneDrive write scope or write API is requested.

Commit:

```text
feat: sync onedrive folders
```

---

## Phase 3D: Read-Only UI, Projection Locks, and Unlink

### Read-only rules

- A folder is read-only when it or any ancestor has an active sync link.
- Enforce read-only behavior in both UI controls and store/database mutation boundaries.
- Disable upload, create, rename, move into, delete, and cut operations.
- Do not expose commands that call OneDrive upload, rename, move, or delete APIs.
- Offline actions such as **Download now**, **Always available offline**, and **Free up space** remain
  available because they only change local cache state.
- Copying from a sync folder into a normal folder creates a physical clone with a new Blob ID.

### Sync item states

Support:

- `pending`
- `downloading`
- `ready`
- `failed`
- `remote-only`
- `available-offline`
- `outdated`
- `insufficient-storage`
- `deleted-pending-release`

Only items with locally available valid content may be presented immediately. Selecting a
`remote-only` item may enqueue a high-priority download, after which presentation becomes available.
Progress and retry controls must be accessible without relying only on opacity or color.

### Projection lock and deletion

- Track active Blob identities used by Presenter and projection windows.
- Remote deletion creates a tombstone first.
- Remove the item from future navigation while preserving active media resources.
- Release the Blob and derivative resources through the common cleanup service only after all active
  projection references are released.
- Apply the same flow to unlink, remote deletion, trash purge, and application restart recovery.

### Unlink options

1. **Remove folder from app**
   - Remove sync metadata and create cleanup tombstones.
   - Delete cached resources after projection locks are released.
2. **Keep files and convert to normal folder**
   - Require all retained files to be fully downloaded.
   - Physically clone shared/provider-managed resources when necessary.
   - Convert atomically; on failure, leave the sync link intact.

### Verification

- Test mutation attempts through UI, store methods, and direct database services.
- Test that no OneDrive write operation is present or issued.
- Test inherited and overridden `online-only`, `on-demand`, and `always-offline` policies.
- Test recursive offline download, partial completion, insufficient quota, restart recovery, and
  **Free up space**.
- Test cached remote replacement while the old Blob is actively projected.
- Test remote delete during image, video, and PDF presentation.
- Test copied files, derivatives, restart recovery, unlink rollback, and final resource cleanup.
- Test accessibility of every sync state.

Commit:

```text
fix: protect synced media lifecycle
```

---

## Phase 4A: Presentation Readiness and Rehearsal

### Readiness analysis

Before presentation starts, analyze the selected playlist by canonical item and Blob identity:

- source media exists and is readable
- media capability is supported on the active platform
- sync item is fully downloaded
- required transcode derivative is ready
- cover and PDF page caches are available or can be generated
- projection window and adapter are responsive
- no item is blocked by a failed or cancelled job

Expose a summarized result:

```ts
interface PresentationReadiness {
  ready: number
  preparing: number
  unsupported: number
  missing: number
  failed: number
}
```

### Readiness UI

- Show item-level status, reason, and available action.
- Allow retry, remove from playlist, or prioritize preparation.
- Never silently remove a failed item.
- Permit presentation with warnings only after explicit confirmation.
- Keep unsupported and missing items out of automatic navigation unless the user explicitly retains
  them.

### Rehearsal mode

- Add an optional rehearsal action that walks the playlist without sending visible output to the
  projection window.
- Prepares only assets required by the playlist:
  - validates native media access
  - prioritizes pending sync downloads
  - queues required transcodes
  - loads PDF metadata and missing page thumbnails
- Do not preload unrelated optional application chunks.
- Support cancellation and show aggregate progress through the persistent job system.

### Playlist snapshot

- Create an immutable presentation snapshot containing item order, item IDs, Blob IDs, and selected
  derivative IDs.
- Background sync rename/reorder operations must not alter the active snapshot.
- Remote deletion uses projection-lock/tombstone behavior until the snapshot is released.

### Verification

- Test mixed ready, pending, unsupported, missing, and failed playlists.
- Test copied media resolving to one Blob and derivative.
- Test readiness during sync and transcode completion.
- Test active snapshot stability during rename, reorder, remote delete, and unlink.
- Test rehearsal cancellation and verify it does not display media in the projection window.

Commit:

```text
feat: add presentation readiness checks
```

---

## Phase 4B: Storage Management Dashboard

### Storage accounting

Display separately:

- Electron native source media
- Web IndexedDB source Blobs
- legacy Electron IndexedDB Blobs
- generated cover thumbnails
- PDF page thumbnails
- video posters
- transcoded derivatives
- sync cache
- temporary and failed-job files

- Calculate usage without loading complete files into memory.
- Show browser quota and persistence status when available.
- Show configured cache budgets and current eviction pressure.

### Cleanup actions

Provide:

- orphan scan
- remove unused derived assets
- remove failed-job and stale temporary files
- clear regenerable thumbnails
- clear unpinned sync cache
- free selected OneDrive files or folders while preserving remote metadata
- rebuild storage index

Never classify original user media as cache. Destructive source-media removal must remain in the
normal trash/permanent-delete flow.

### Automatic cache eviction

- Add configurable budgets for regenerable derivatives and sync cache.
- Use least-recently-used eviction among assets that are:
  - not projection-locked
  - not required by an active presentation snapshot
  - not pinned for offline use
  - not referenced by an active job
- Eviction removes the physical asset and updates its registry atomically.
- Regeneration should occur through the persistent job system on next demand.

### Integrity and orphan detection

- Detect missing native files, records without files, files without records, stale temporary files,
  and derived assets whose source no longer exists.
- Run quick existence checks on demand; do not hash every large file during startup.
- Provide a diagnostics export that excludes tokens, authorization codes, raw filesystem paths, and
  media content.

### Verification

- Test accounting against mixed native, IndexedDB, legacy, derivative, and sync data.
- Test that every cleanup operation preserves source media.
- Test LRU exclusions for projection locks, snapshots, pins, and active jobs.
- Test interruption and restart during cleanup.
- Test diagnostics redaction.

Commit:

```text
feat: add media storage management
```

---

## Preferences Integration

All preference UI in this plan belongs under the existing `Preferences > Media` category. Use
separate sections so security and storage settings are not mixed with ordinary playback controls.

### Video Transcoding

- FFmpeg status, basename, version, and capability result
- select, revalidate, and remove FFmpeg configuration
- platform installation guidance
- Electron only
- raw executable path persisted by the main process; renderer persists no path

### OneDrive

- built-in or custom Azure Application Client ID
- restore default Client ID
- sign in, reauthenticate, and disconnect
- default offline policy
- sync cache budget
- Client ID and non-sensitive preferences use shared renderer settings persistence
- credentials remain in platform-specific protected storage

### LAN Remote Control

- enable service and select private interface
- pairing QR code and active controller
- allow trusted devices
- trust duration, default `30` days, range `1` to `90`
- trusted-device management and revoke actions
- non-sensitive preferences use shared renderer settings persistence
- trusted credential hashes and session secrets remain in protected main-process storage

### Media Storage

- derived-asset cache budget
- sync cache budget, linked to the OneDrive section rather than duplicated as independent state
- storage usage and eviction pressure
- cleanup, integrity scan, and diagnostics actions
- browser persistence status in Web mode

### Preference validation

- Add settings schema version migrations for every new persisted field.
- Validate persisted values during hydration and restore documented defaults for invalid values.
- Platform-specific controls must be hidden or disabled with an explanation when unavailable.
- Resetting general preferences must not delete credentials, trusted devices, source media, cached
  OneDrive files, or completed derivatives without a separate explicit confirmation.
- Add preference UI tests for defaults, persistence, migration, platform visibility, validation, and
  destructive-action confirmation.

---

## Post-Implementation Roadmap

The remaining partial non-roadmap phases listed in **Implementation Status** are still prerequisites
for calling the implementation plan complete. The roadmap below is ordered by product value and
dependency, not by technical novelty.

1. Recovery Center.
2. Service Plan / Setlist.
3. LAN Mobile Remote Control.
4. Media Metadata Inspector.
5. Stage Display.
6. Duplicate Detection.
7. Fallback Media, Presenter Notes, and Presentation History.
8. Output Profiles and Multiple Managed Outputs.
9. NDI / Virtual Camera feasibility.
10. Shared Cloud Library and role-based collaboration as a separate feature, never as a transport
    for LAN remote control.

OneDrive offline availability is no longer a roadmap item because it is part of Phase 3C and Phase
3D. Bidirectional OneDrive editing is explicitly out of scope.

---

## Roadmap R1: Recovery Center

### Goal

Provide one place where an operator can understand and recover from actionable problems without
searching through upload dialogs, sync folders, storage settings, or logs.

The Recovery Center is a view over existing persistent state. It must not become a second generic
error database or ingest every `console.error`.

### Issue sources

Aggregate actionable issues from:

- failed or interrupted persistent media jobs
- missing native media and integrity scan findings
- failed thumbnails or derived assets
- transcode failures
- OneDrive authentication, quota, download, and outdated-cache failures
- local sync permission loss or disconnected volumes
- storage cleanup failures and orphan findings
- projection window crash, disconnect, or failed readiness checks

Each source exposes stable issue references:

```ts
type RecoveryIssueKind =
  | 'job-failed'
  | 'media-missing'
  | 'asset-failed'
  | 'sync-auth'
  | 'sync-download'
  | 'storage-integrity'
  | 'projection-health'

interface RecoveryIssue {
  id: string
  kind: RecoveryIssueKind
  severity: 'info' | 'warning' | 'error'
  titleKey: string
  detailKey: string
  sourceId?: string
  itemId?: string
  blobId?: string
  occurredAt: number
  actions: RecoveryAction[]
}
```

- Store the authoritative failure in its owning job, sync, asset, or integrity record.
- Derive Recovery Center entries through source adapters.
- Persist only source-specific findings that do not already have an authoritative record.
- Use localization keys and structured parameters rather than persisting rendered messages.
- Do not include access tokens, raw filesystem paths, media content, or stack traces in UI records.

### Recovery actions

Expose only actions supported by the issue source:

- retry job
- cancel and remove failed job
- locate or re-import missing media
- reauthenticate provider
- retry sync download
- download now
- free local cache
- regenerate thumbnail or derivative
- run integrity repair
- reopen projection window
- remove unavailable item from the active playlist
- export redacted diagnostics

- Every action must be idempotent or protected against duplicate execution.
- Show destructive confirmation only when original user data may be removed.
- Recovery retries use the persistent job system and normal concurrency limits.
- A manually dismissed issue reappears if the authoritative failure remains active.
- Automatically resolve entries when their source returns to a healthy state.

### User interface

- Add a global warning indicator with unresolved error/warning counts.
- Provide filters for `All`, `Media`, `Sync`, `Storage`, and `Projection`.
- Sort active errors first, then warnings, then newest occurrence.
- Show concise status and one recommended primary action.
- Keep technical details collapsed by default.
- Provide batch retry only for actions that are independently safe.
- Link directly to the affected file, folder, job, or settings page when available.

### Health summary

Show:

- failed jobs
- missing media
- sync connection status
- offline availability failures
- storage pressure
- projection window health

Do not report historical resolved incidents as current health failures. Keep optional redacted history
with a bounded retention period for diagnostics.

### Verification

- Test issue aggregation without duplicating authoritative records.
- Test automatic appearance, update, dismissal, and resolution.
- Test retry deduplication and concurrency limits.
- Test missing-media relink while copied items share the same Blob.
- Test sync reauthentication and insufficient-storage recovery.
- Test projection crash/reopen behavior.
- Test diagnostics and UI records for secret/path redaction.
- Test accessibility, keyboard operation, and localization.

Suggested commits:

```text
feat: add recovery issue aggregation
feat: add recovery center
```

---

## Roadmap R2: LAN Mobile Remote Control

### Product boundary

LAN remote control is permanently scoped to the local network. It is not a first step toward
internet remote access.

The feature is Electron-only because Electron can host a local control service. The phone uses a
normal mobile browser and does not require a native application.

Web deployment support is out of scope for the first version because a browser page cannot reliably
open a LAN server. Cloud relay, internet access, user accounts, remote file management, and control
across separate networks are permanent non-goals.

The LAN remote must continue to work without an internet connection. No remote-control command,
session, pairing request, or state update may depend on a cloud service.

### Supported controls

MVP controls:

- current and next item summary
- previous, next, and jump to playlist item
- media play and pause
- blank/unblank projection
- timer start, pause/resume, reset, add time, and remove time
- stopwatch start, pause, and reset
- connection, projection, and timer status

Not allowed:

- file upload or download
- filesystem or OneDrive browsing
- folder/file mutation
- application settings changes
- arbitrary projection messages
- arbitrary IPC invocation
- speech/model controls

### Command gateway

Define one runtime-validated remote contract:

```ts
type RemoteCommand =
  | { type: 'presentation:prev' }
  | { type: 'presentation:next' }
  | { type: 'presentation:jump'; index: number }
  | { type: 'media:play' }
  | { type: 'media:pause' }
  | { type: 'projection:blank'; enabled: boolean }
  | { type: 'timer:command'; command: TimerCommand }
```

- The LAN server never sends directly to the projection window.
- Main process forwards validated commands only to the main renderer command gateway.
- The main renderer invokes existing Zustand actions, Presenter commands, projection context, and
  timer adapters so desktop and mobile controls use the same source of truth.
- The renderer publishes a sanitized remote state snapshot back to the main process.
- Do not expose Blob IDs, native media URLs, filesystem paths, notes, tokens, or unrestricted store
  state to the phone.
- Add command acknowledgements with request IDs so the phone can distinguish accepted, rejected, and
  timed-out commands.

### Local server

- Implement the control service in the Electron main process.
- Keep it disabled by default.
- Start it only after the operator explicitly enables remote control.
- Bind only to the selected active private LAN interface; never expose it through an internet-facing
  interface intentionally.
- Stop and invalidate sessions when:
  - remote control is disabled
  - the app exits
  - the machine sleeps
  - the selected network interface changes
- Serve a small bundled mobile UI and a WebSocket state/command channel.
- Do not load remote scripts, fonts, analytics, or CDN assets.
- Add payload size limits, connection limits, heartbeat timeout, command rate limiting, and runtime
  schema validation.
- Do not enable CORS for arbitrary origins.

### Pairing and sessions

- Display a QR code and short human-readable confirmation code on the desktop.
- The QR payload contains the private LAN URL and a high-entropy one-time pairing secret.
- Pairing secrets expire quickly and are invalid after first successful use.
- Require desktop confirmation showing the device name before granting control.
- Issue a random short-lived session token after approval.
- Store only a hash of active session tokens in memory.
- Support optional trusted devices:
  - disabled by default at the global preference level until the operator enables it
  - default trust duration: `30 days`
  - configurable duration in Preferences with a bounded range of `1` to `90` days
  - desktop must explicitly approve **Trust this device** during pairing
  - enabling trusted-device support never auto-trusts a newly paired device
- A trusted-device credential only authorizes obtaining a new short-lived LAN session; it cannot send
  control commands directly.
- Generate a separate credential per trusted browser/device and store only its hash, device label,
  creation time, last-used time, and expiry in protected main-process storage.
- On the phone, prefer a non-exportable Web Crypto key and challenge-response proof. If a supported
  browser cannot persist the key safely, fall back to normal one-session pairing rather than storing
  a long-lived plaintext bearer token.
- Trust is valid only on the locally paired HHC Client installation and still requires connection
  through the selected private LAN interface.
- Expired credentials are rejected and removed automatically.
- Allow the desktop operator to revoke one device or all sessions immediately.
- Allow the desktop operator to revoke one trusted device or all trusted devices immediately.
- Permit multiple read-only observers, but only one active controller lease by default.
- A new controller requires explicit takeover approval or release by the current controller.

Local-network transport does not provide the same trust guarantees as a cloud service with managed
TLS. The UI must describe this as trusted-LAN control and recommend a private church network rather
than public Wi-Fi. Security improvements may add local certificate pinning or application-layer
encryption, but must not introduce cloud relay, external account login, or internet routing.

### Preferences

Add `Preferences > Media > LAN Remote Control`:

- enable LAN remote control
- selected private network interface
- show pairing QR code
- allow trusted devices
- trust duration in days, default `30`, allowed range `1` to `90`
- trusted-device list with device label, last used, and expiry
- revoke one trusted device
- revoke all trusted devices
- current active controller
- disconnect current controller
- stop all LAN remote sessions

- LAN remote settings use the shared settings persistence adapter.
- Trusted credential hashes and session secrets stay in protected main-process storage and are not
  persisted in renderer settings.
- Disabling LAN remote immediately stops sessions. Trusted devices remain listed unless the operator
  chooses **Disable and revoke all devices**.
- Reducing the trust duration applies to new trust grants. Provide a separate action to expire
  existing devices that exceed the new duration.

### Mobile interface

- Design for one-handed portrait use with large controls.
- Keep `Previous`, `Next`, and `Blank` visible without scrolling.
- Use press feedback only after command acknowledgement.
- Show disconnected/reconnecting state clearly.
- Disable commands when desktop state says they are unavailable.
- Show playlist item names and timer state, but no media binary or thumbnail in MVP.
- Prevent the phone display from sleeping while an active control session is open when browser APIs
  allow it.

### State and reconnect behavior

- Send a full sanitized state snapshot after pairing and reconnect.
- Send versioned incremental updates after the initial snapshot.
- Include monotonically increasing state revision numbers.
- Reject stale commands whose required presentation snapshot no longer matches.
- Never replay unacknowledged mutating commands automatically after reconnect.
- Timer display may update locally between server snapshots, but server state remains authoritative.

### Security verification

- Test binding behavior on private, public, loopback, VPN, and changing interfaces.
- Reject VPN, public, and non-private interfaces by default; any supported interface must be selected
  explicitly from locally detected private-network addresses.
- Test expired/reused pairing secrets, invalid session tokens, controller takeover, and revocation.
- Test trusted-device grant, expiry, configurable duration, challenge-response, browser fallback,
  single-device revoke, revoke-all, and loss of phone browser storage.
- Test malformed messages, oversized payloads, command flooding, stale revisions, and replay attempts.
- Test that unsupported commands cannot reach IPC, filesystem, sync, or projection channels.
- Test app sleep, network change, renderer crash, projection crash, and app shutdown cleanup.
- Test that remote snapshots and diagnostics contain no sensitive fields.

### Functional verification

- Pair with iOS Safari and Android Chrome on the same LAN.
- Verify pairing and control work while the internet connection is unavailable.
- Verify a device outside the selected LAN cannot connect through a cloud fallback or external
  service because no such path exists.
- Verify previous/next/jump, media play/pause, blank, timer, and stopwatch controls.
- Verify desktop and phone state remain synchronized when either side operates controls.
- Verify loss and restoration of Wi-Fi does not duplicate commands.
- Verify the projection remains controllable after the phone disconnects.

Suggested phased commits:

```text
feat: add lan remote command gateway
feat: add secure lan remote pairing
feat: add mobile remote interface
```

---

## Documentation and Final Acceptance

Update project documentation with:

- canonical MIME inference rules
- media capability registry ownership and extension process
- unified upload entry points
- persistent job scheduling, recovery, and retention
- generalized derived-asset ownership and cleanup
- generated cover Blob identity and item-level custom cover override resolution
- PDF queue and lazy-loading decision
- rename and naming normalization rules
- transcoding feasibility decision
- user-managed FFmpeg selection, validation, minimum version, and blocked-job behavior
- sync provider security boundaries
- built-in/custom OneDrive Client ID behavior and authentication responsibility boundaries
- OneDrive one-way synchronization and offline availability policies
- OAuth credential storage differences between Web and Electron
- projection lock and unlink behavior
- presentation readiness and snapshot behavior
- storage budgets, eviction, integrity checks, and diagnostics redaction
- LAN trusted-device duration, credential storage, session exchange, and revocation
- Preferences ownership, defaults, migrations, validation, and platform visibility

Final acceptance:

- Empty MIME image, video, and PDF files behave according to their recognized extensions.
- Every upload entry point preserves Electron native storage and Web IndexedDB behavior.
- Duplicate folder uploads and inline renames follow one consistent naming policy.
- Presenter controls pass pointer, keyboard, Electron, and Web verification.
- Unsupported video files never bypass the transcode-required state.
- Upload, thumbnail, Presenter, and transcode decisions agree with the capability registry.
- Interrupted jobs recover without duplicate processing or orphan temporary files.
- Renderer and main process reconcile native job state without either side independently claiming
  completion.
- Copies share generated assets while item-level custom covers remain independent.
- Grid and Next Preview resolve custom `itemId` covers before generated `blobId` covers.
- Native media and derivative IDs remain UUIDs.
- Electron packages do not bundle FFmpeg; user-selected executables are validated and their raw paths
  never enter renderer persistence, diagnostics, or remote-control state.
- Missing FFmpeg configuration blocks new transcodes without invalidating completed derivatives.
- Every accepted FFmpeg configuration produces the documented MP4/H.264/AAC/yuv420p/faststart
  compatibility profile.
- FFmpeg is never loaded during unrelated cold starts.
- Sync credentials and filesystem paths are not exposed in renderer domain records.
- OneDrive uses the built-in Client ID unless a validated custom Client ID is configured, and Client
  ID changes require reauthentication without deleting cached media.
- OneDrive sync never uploads local mutations or invokes remote write operations.
- `always-offline` folders report complete only after every eligible descendant is locally available.
- Offline cache eviction preserves pinned content and all remote metadata.
- Synced media cannot be mutated through lower-level store or database calls.
- Remote deletion or unlink cannot interrupt active projection.
- Readiness reports missing, pending, unsupported, and failed media before presentation.
- Active presentation snapshots are stable against background sync changes.
- Storage cleanup and eviction never delete original user media.
- LAN trusted devices default to 30 days, remain LAN-only, exchange their credential only for
  short-lived sessions, and can be revoked individually or globally.
- Every new preference has validated defaults, migration coverage, correct persistence ownership,
  and platform-appropriate visibility.
- No failed job, deletion, or unlink leaves orphan Blobs, native files, derivatives, thumbnails, or
  temporary files.

Final documentation commit:

```text
docs: update file and sync architecture
```
