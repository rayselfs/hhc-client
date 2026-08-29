# VLC Projection Production Reliability Design

## Scope

Make Electron VLC projection deterministic across first playback, rapid item replacement,
transport commands, seeking, remote downloads, and recoverable Matroska container damage. Preserve
browser playback, imported source bytes, current HHC Presenter storage identity, and the existing
single main-process VLC owner.

Production reliability means:

- the UI stays responsive while VLC starts or FFmpeg remuxes;
- commands are never silently dropped, replayed onto another item, or reported as confirmed before
  VLC confirms them;
- events from an old player cannot mutate the active session;
- a derivative is never reused after its source content changes;
- deleting or replacing a source cannot leave an active process that recreates an orphan cache;
- healthy, recoverably damaged, and unreadable inputs produce distinct, testable outcomes;
- macOS and Windows packaged applications pass the same VLC regression contract before merge.

## Confirmed failure classes

1. `projection-vlc:control` currently drops commands while runtime discovery/player embed is in
   flight because no active `player` exists yet.
2. `setSource()` installs media synchronously but does not prove that VLC can play or seek it.
3. `projection-vlc:started` currently follows method calls rather than a decoded/playback event.
4. player event callbacks read module-global ownership; a delayed event from a destroyed player can
   publish state for a replacement item.
5. seek state is optimistic in both the coordinator and preview; `setTime()` success is not a seek
   capability or confirmation contract.
6. desktop-engine readiness hard-codes seekability and synchronously calls libVLC
   `probeMedia(..., 5000)` in Electron's main process.
7. Matroska may contain broken SeekHead/cues or misleading duration while its readable packets are
   otherwise intact. VideoToolbox decoder-selection messages are informational.
8. remote HHC Matroska does not have a native source until projection-time download completes, so
   readiness-only remux routing misses that path.

## Architecture

### 1. One owned VLC session

Keep one module-local session record containing the captured player, item ID, projection generation,
lifecycle version, source-install state, media-ready state, confirmed seekability, and coalesced
pending controls. Create the session before any asynchronous runtime lookup so controls arriving
during lookup or embed have an owner.

Every VLC event handler captures that session. Before reading native state or publishing an event,
it verifies that the captured player/session is still active and that the projection generation and
lifecycle version still match. Replacement, stop, projection close, startup failure, and runtime
failure invalidate the session before destroying the player.

Pending controls retain only the latest volume, seek, and final transport command. A queued command
overrides the corresponding initial replay value. Apply volume after source installation, keep the
native child window hidden, and issue one internal `play()` to make libVLC open and decode the media.
The first owner-matched `playing` event establishes media readiness but is an internal bootstrap
event, not confirmation of the requested transport. At that point, apply seek only when
`player.isSeekable() === true`. If seek is requested, wait for an owner-matched time event within one
second of the requested position before applying final transport. Final pause waits for `paused`; final play waits
for owner-matched playing/time confirmation. Only then reveal the native window and publish durable
state. A non-seekable seek request is rejected without calling `setTime()`. One 15-second watchdog
covers source open, seek confirmation, and final transport confirmation; every invalidation clears
it and tears down the owned session instead of leaving projection pending forever.

`projection-vlc:started` means only that the native surface and source are installed. It is never a
decoded-frame, playing, or seek-confirmation signal.

### 2. VLC-confirmed playback state

`file:playback-state` is authoritative for VLC playback. Extend it with `seekable?: boolean` and
`volume?: number`, and publish owner-matched state from finalized playing, paused, stopped, end,
error, time, length, and buffering transitions exposed by `electron-vlc-player`.

The renderer distinguishes requested state from confirmed state:

- the coordinator keeps confirmed replay state separate from latest pending volume, seek, and
  transport requests;
- commands may update transient interaction affordances, but not durable replay position/transport;
- commands issued while projection is opening/recovering, or sent but not yet confirmed, survive
  recovery in one atomic `__system:replay` pending-control envelope; the projection renderer overlays
  that envelope onto local start values without mutating the coordinator's confirmed snapshot;
- coordinator replay and Zustand video state change position, transport, duration, end state, and
  seekability only from `file:playback-state`; confirmed volume also clears its pending request;
- the slider and relative-seek shortcut are disabled until `seekable === true`;
- a seek request remains visually pending until a later VLC time event confirms the position.

Pending seek confirmation uses the same one-second tolerance as startup finalization. Pending volume
clears when owner state matches the integer VLC volume within `0.01` after normalization to `[0, 1]`.
Every main-process volume command performs an owner-safe `getVolume()` acknowledgement immediately
after `setVolume()`, including while paused. Owner state with `seekable: false` explicitly rejects and
clears a pending seek so recovery does not replay it forever.

Each VLC start attempt carries a renderer-generated attempt ID. Effect cleanup sends an owner-scoped
stop for that attempt; projection close/blackout may still force-stop the active session. Completion
of an old async stop/remux abort can never invalidate a newer attempt for the same item.

Missing `seekable` remains backward compatible and is treated as unknown/not seekable for embedded
VLC. Native browser/video-element playback keeps its existing HTML media capability path.

### 3. Remove synchronous probing

Desktop-engine readiness does not request source metadata or a header-derived duration. Remove the
`projection-vlc:probe` channel, preload surface, validator, handler, and native helper. VLC playback
events provide duration and capability asynchronously. Browser/native HTML media metadata remains
unchanged.

### 4. Fingerprinted Matroska derivative

For Electron desktop-engine Matroska only, create an on-demand cached `.mkv` derivative with bundled
FFmpeg stream copy:

```text
-hide_banner -nostdin -y -i <source> -map 0 -c copy -f matroska <temp.mkv>
```

The renderer sends only an authorized native source ID plus a
`playbackVariant: 'matroska-remux'` token in the existing VLC start request. The main process resolves
and ensures the derivative inside the owned startup session. Absolute paths never cross preload. The
source remains byte-identical.

Cache identity includes the validated source ID and an asynchronously computed SHA-256 fingerprint.
A private `video-remux-cache` directory under dynamic `app.getPath('userData')` stores
`<sourceId>.mkv`, `<sourceId>.json`, and same-directory `.<sourceId>.<uuid>.tmp.mkv` files. A sidecar
records the fingerprint, source size, source mtime, output size, and creation time. Cache
reuse requires a matching current fingerprint and a non-empty derivative. Atomic source replacement
and source deletion invalidate the source generation, abort/wait for an in-flight remux, and remove
the derivative, sidecar, and temp files. Before final rename, remux revalidates ownership and source
identity so cleanup cannot be followed by an orphan rename.

Use one in-flight promise per source and no durable job table. FFmpeg execution is asynchronous with
`shell: false`, bounded captured output, caller-specific timeout, AbortSignal termination, and
wait-for-close cleanup. Poster extraction keeps its existing 15-second timeout; remux uses a
30-minute hard ceiling. Before remux, require at least `ceil(sourceSize * 1.2) + 256 MiB` available.
Startup removes stale remux temp files older than 24 hours.

### 5. Local and remote routing

Readiness marks supported Electron Matroska with a derivative variant token but does not remux the
whole playlist. Local Matroska reaches `projection-vlc:start` immediately; remote HHC Matroska first
completes the existing authorized projection-time download, then commits the same variant token.
The owned main-process startup ensures only the current source before embedding VLC. This keeps the
renderer event loop responsive and avoids delaying the first item behind every MKV in the playlist.

Remote download and payload commit retain the existing project sequence, session revision, current
item, and access-revocation fences. Main-process derivative work is additionally fenced by the owned
VLC session. Superseded work may finish into a valid cache but cannot embed VLC or publish state for
the old request.

### 6. Failure policy

Classify outcomes rather than treating all MKV failures as repairable:

- healthy or recoverably damaged container with readable clusters: remux succeeds and VLC uses the
  derivative;
- unreadable/truncated packet payload: remux fails cleanly, temp/cache is removed, source is
  preserved, VLC is not embedded, and the existing projection recovery notice exposes retry; a
  renderer-local replay revision makes same-generation retry start one new owned VLC attempt;
- insufficient storage, timeout, cancellation, missing runtime, or source replacement: use stable
  failure codes and preserve the source;
- playback error/premature end after successful start: publish terminal owner-matched state and a
  recoverable VLC failure without contaminating a replacement session.

## Acceptance matrix

| Case                                             | Required result                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Healthy MP4                                      | Existing native HTML playback remains unchanged                               |
| Healthy MKV                                      | Fingerprinted derivative created once; confirmed playback and seek            |
| MKV with broken/missing cues but intact clusters | Remux succeeds; confirmed seek within readable duration                       |
| Payload-truncated/unreadable MKV                 | Clean preparation failure; no cache, VLC embed, source mutation, or UI lockup |
| Non-seekable input                               | `seekable: false`; slider and relative seek disabled; no `setTime()`          |
| Rapid start/stop/item replacement                | No stale command/event/state/window leakage                                   |
| Same source ID with new bytes                    | Old derivative rejected and replaced before playback                          |
| Remote HHC MKV                                   | Download, payload commit, and owned remux obey authorization/session fences   |
| Delete during remux                              | Process aborts/settles before cleanup; no derivative appears afterward        |

## Verification gates

1. Focused unit/contract tests prove session ownership, pending-command precedence, authoritative
   state, validators, remote routing, cache identity, process abort, and cleanup races.
2. Full lint, typecheck, unit, build, bundle-budget, and browser projection E2E pass.
3. A PR-head `workflow_dispatch` packages macOS arm64 and Windows x64 without publishing and runs the
   same packaged VLC matrix using each bundled runtime.
4. Packaged fixtures are small and deterministic. Before import, the helper verifies committed
   hashes/Matroska structure and uses the bundled FFmpeg decoder for readable/unreadable packet
   expectations; system FFprobe and runtime H.264 encoding are not assumed.
5. Installed-device smoke on macOS and Windows confirms visible playback, confirmed mid-stream seek,
   rapid replacement, failure recovery, and responsive control/projection windows.
6. No merge, tag, release, updater manifest, or deployment occurs until all required evidence is
   reviewed and the user authorizes the next gate.

## Rebrand and storage boundary

Always use dynamic `app.getPath('userData')`. Old LibrePresenter data is reproduction evidence only;
acceptance imports fresh fixtures into HHC Presenter. Package assertions use `hhc-presenter`,
`HHC Presenter`, and `tw.org.alive.presenter`.

## Non-goals

- Re-encoding media or repairing unreadable packet payloads.
- Replacing VLC, VideoToolbox, FFmpeg, or `electron-vlc-player`.
- Import-time normalization, a second player, renderer retry loop, worker pool, or durable remux job
  infrastructure.
- Treating unit tests, `projection-vlc:started`, or VideoToolbox log lines as packaged playback
  acceptance.
