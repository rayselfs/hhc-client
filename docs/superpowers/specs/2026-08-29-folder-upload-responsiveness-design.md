# Folder Upload Responsiveness and Stopwatch Reliability Design

## Scope

Prevent folder import from monopolizing the renderer or Electron main process, and restore the
Electron stopwatch tick path. Preserve imported files, folder structure, media enrichment,
presentation readiness, and browser timer behavior.

## Confirmed blocking path

`uploadPreparedFiles()` currently starts several enrichment paths for each stored file:

- Electron native video metadata invokes the synchronous main-process VLC probe.
- PDF cover generation parses/renders page one in the renderer.
- PDF page generation parses the PDF again and renders every page in the renderer.
- the renderer media queue limits concurrency but does not move work off the renderer thread.

The upload semaphore limits simultaneous promises; it cannot prevent CPU-bound PDF.js/canvas work
from blocking the event loop. A PDF extension is therefore not itself the problem. Eager repeated
parsing/rendering during folder import is.

## Design

Define upload completion as source persistence plus folder/file database records. After a file is
stored, release the upload semaphore immediately. Schedule the existing cover-thumbnail and
Electron video-poster jobs as best-effort enrichment; their failure cannot change the upload count.

### Import orchestration boundary

Keep Electron source copy in the existing main-process `fs.promises.copyFile` path with the shared
concurrency limit of three; it is already asynchronous native I/O and does not need another Worker.
Time-slice renderer orchestration with the existing `yieldToMain()` at these boundaries:

- after each bounded batch of candidate classification and relative-path mapping;
- after each newly created folder, preserving the existing behavior;
- after each persisted file releases its semaphore slot, before the next queued import can consume
  a continuous chain of microtasks.

Use an eight-millisecond renderer work budget rather than a fixed file count because filenames,
folder depth, and store size vary. This keeps one import step bounded while avoiding an additional
queue or scheduler. Source copy and file/database failures retain their current rollback behavior.

Do not request source metadata or all PDF page thumbnails from the upload path. Existing
presentation readiness remains the owner of PDF page preparation. VLC presentation reliability
removes the synchronous native probe from desktop readiness separately.

### Background rendering boundary

Keep the current media job queue as the durable orchestrator. Move the shared image/PDF thumbnail
implementation behind one lazily-created dedicated module Worker so every existing caller benefits:

- image cover: `createImageBitmap()` plus `OffscreenCanvas`;
- PDF cover and PDF pages: PDF.js plus `OffscreenCanvas`;
- output: JPEG `Blob` values transferred back to the renderer and stored through the existing
  derived-asset database;
- cancellation: request ID plus an explicit cancel message connected to the existing media-job
  `AbortSignal`;
- failure: reject the existing job so its retry/status behavior remains authoritative.

Do not convert worker output back to data URLs. `thumbnail-db.ts` already stores `Blob` and
`Blob[]`; use those paths to avoid renderer-side base64 conversion. Keep one worker client and the
existing queue concurrency instead of adding another scheduler or worker pool.

Electron video posters remain in the existing FFmpeg child process. Browser video thumbnail
extraction may keep its bounded `<video>` single-frame path because it is not implicated in the
observed PDF freeze; it must yield before and after canvas encode. Do not move video decode to
WebCodecs without separate evidence.

The Worker is required for Electron and supported browser environments. If `Worker`,
`OffscreenCanvas`, or `createImageBitmap` is unavailable, mark the media job blocked with the
existing `configuration` reason and keep the source usable with a placeholder. Never fall back to
CPU-heavy image/PDF rendering on the UI thread.

## Confirmed stopwatch failure

The renderer owns the selected timer mode. In Electron, `TimerService` owns the running stopwatch
and emits `timer-tick`, but it remains in its default `timer` mode because renderer mode changes are
never sent through the adapter. `ElectronTimerAdapter` forwards stopwatch ticks only when the main
payload reports `mode: 'stopwatch'`. The main stopwatch therefore advances while the control store
receives no tick and appears frozen.

This is unrelated to folder upload blocking. They share one delivery plan and one combined smoke,
not one implementation or abstraction.

## Stopwatch design

Reuse the existing `TimerCommand` variant `{ type: 'setMode'; mode: TimerMode }`. Add
`TimerAdapter.syncMode(mode)` with a browser no-op and an Electron implementation that sends the
existing command. `TimerEngineProvider` synchronizes the hydrated initial mode and every later mode
change. Keep the existing stopwatch engine, store actions, tick interval, and projection bridge.

## Acceptance

- Upload result resolves after every accepted source and database record is persisted, without
  awaiting metadata, PDF pages, cover completion, or poster completion.
- A multi-level folder containing images, PDFs, videos, and ignored system files preserves current
  naming, count, quota, and folder-yield behavior.
- Candidate classification, path mapping, folder creation, source persistence, and store
  publication yield often enough that no single upload-orchestration long task exceeds 50 ms in the
  clean-profile Electron trace.
- Uploading a multi-page PDF never enqueues `pdf-pages` or invokes VLC metadata probing.
- Opening/presenting that PDF still enqueues page preparation through presentation readiness, and
  every PDF render/encode occurs in the dedicated Worker.
- Cover and PDF-page assets remain JPEG `Blob` records readable by the existing thumbnail and PDF
  preview consumers.
- Worker crash, cancellation, and unsupported capability leave the source intact and produce an
  existing failed/blocked job that can be retried after recovery.
- During an Electron `npm run dev` smoke, the UI heartbeat remains interactive while a representative
  folder imports and while PDF pages prepare; DevTools evidence records no image/PDF
  decode/render/encode task on the renderer thread.
- A stress fixture with at least 1,000 small supported files and nested paths keeps the window
  operable and continues repainting a 100 ms heartbeat throughout classification and
  persistence. This validates orchestration separately from the mixed-media fixture.
- In Electron, an initial or newly selected stopwatch mode reaches `TimerService`; start advances
  the control display, pause holds it, resume continues, and reset returns to zero.
- With stopwatch projection enabled, control and projection advance together. Switching back to a
  countdown mode does not leak stopwatch-mode ticks.
- A stopwatch started during representative folder import continues advancing, demonstrating that
  upload work no longer starves its renderer updates.

## Rebrand boundary

The rename changed product/package/application identity but did not change the upload pipeline.
Acceptance must use a clean/current HHC Presenter profile. Old LibrePresenter IndexedDB/native-file
state is not evidence for the renamed application.

## Non-goals

- Redesigning the media queue or thumbnail database.
- Adding job progress UI, cancellation UI, or a worker pool.
- Generating PDF page thumbnails before the user requests presentation readiness.
- Changing browser quota limits, file classification, naming, sync import, or trash retention.
- Replacing the timer adapter, stopwatch store, main timer service, or projection bridge.
- Refactoring renderer stopwatch elapsed-time calculation unless separate drift evidence requires it.
- Moving browser video decoding to WebCodecs or adding a new media dependency.
