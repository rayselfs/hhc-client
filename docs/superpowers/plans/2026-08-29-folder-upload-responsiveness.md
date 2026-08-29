# Folder Upload Responsiveness and Stopwatch Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep HHC Presenter responsive throughout folder import and background media preparation, while restoring Electron stopwatch updates in control and projection.

**Architecture:** Keep upload and stopwatch as independent task groups. Time-slice folder orchestration, leave native file copy on async `fs.copyFile`, and move shared image/PDF rendering behind one lazy dedicated Worker that returns `Blob` assets through the existing media queue. Reuse the existing timer `setMode` command to synchronize Electron main with renderer; add no new dependency, queue, timer engine, or Worker pool.

**Tech Stack:** React 19, TypeScript, Vite module Workers, OffscreenCanvas, PDF.js, IndexedDB/idb, Electron IPC, Zustand, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-29-folder-upload-responsiveness-design.md`

**Implementation status:** Completed and verified on 2026-08-29. The checklist below records the
approved execution sequence; final evidence is captured in the PR.

## Global Constraints

- Preserve file classification, quota checks, duplicate naming, ignored-system-file policy, folder creation order, sync import, trash, and cleanup behavior.
- Upload success means source and database record persisted; enrichment never changes the returned count.
- Image/PDF decode, render, and encode must not run on the renderer thread.
- Never fall back to CPU-heavy image/PDF rendering on the renderer when Worker capabilities are unavailable.
- Keep Electron source copy on async `fs.promises.copyFile` with shared concurrency three.
- Keep browser video single-frame extraction and Electron FFmpeg poster behavior unchanged.
- Preserve browser Worker stopwatch behavior and projection ownership rules.
- Use a fresh HHC Presenter profile for smoke; old LibrePresenter data is not evidence.
- Follow RED-GREEN-REFACTOR. Create one PR, wait for CI, merge only when green, and do not tag or release.

---

### Task 1: Time-slice folder import and detach enrichment

**Files:**

- Modify: `src/renderer/src/lib/upload-utils.ts`
- Modify: `src/renderer/src/lib/__tests__/upload-utils.test.ts`

**Interfaces:**

- Consumes: existing `yieldToMain(): Promise<void>` and shared upload semaphore.
- Produces: `createRendererBudget(maxWorkMs?: number): { yieldIfNeeded(): Promise<void> }` with default `8` ms, local to `upload-utils.ts`.

- [ ] Add failing tests proving candidate classification and destination mapping yield when an injected clock crosses eight milliseconds, and every persisted Electron file yields after releasing its semaphore slot.
- [ ] Add a failing test that leaves cover/poster enqueue promises pending and proves `uploadFiles()` resolves after `addFileItemToStore()`.
- [ ] Add failing mixed-folder assertions that upload never calls `ensureSourceMediaMetadata()` or `ensurePdfPageJob()`.
- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/upload-utils.test.ts`. Expected: FAIL because classification/mapping are synchronous and upload awaits or starts eager enrichment.
- [ ] Implement one eight-millisecond budget helper using `performance.now()` and the existing `yieldToMain()`; reset its deadline after each yield.
- [ ] Replace synchronous candidate/destination maps with loops that call `yieldIfNeeded()`. Keep the existing per-new-folder yield.
- [ ] Release the semaphore immediately after source/database persistence, then yield before the next queued import proceeds.
- [ ] Delete upload-path calls to `ensureSourceMediaMetadata()` and `ensurePdfPageJob()`. Enqueue cover/poster work as caught, detached best-effort work after persistence.
- [ ] Keep web storage/quota and browser video thumbnail behavior unchanged.
- [ ] Re-run the focused suite. Expected: PASS with existing size, naming, MIME, folder-order, and concurrency cases unchanged.
- [ ] Commit with `fix: time-slice folder imports`.

### Task 2: Add one background image/PDF render Worker

**Files:**

- Create: `src/renderer/src/workers/thumbnail-render.worker.ts`
- Create: `src/renderer/src/lib/thumbnail-worker-client.ts`
- Create: `src/renderer/src/lib/__tests__/thumbnail-worker-client.test.ts`
- Modify: `src/renderer/src/lib/thumbnail-generator.ts`
- Modify: `src/renderer/src/lib/__tests__/thumbnail-generator.test.ts`
- Delete: `src/renderer/src/lib/__tests__/upload-pdf-queue.test.ts` (obsolete eager-upload contract)

**Interfaces:**

- Produces worker requests:

  ```ts
  type ThumbnailWorkerRequest =
    | { id: string; type: 'cover'; file: File; mimeType: string }
    | { id: string; type: 'pdf-pages'; file: File }
    | { id: string; type: 'cancel' }
  ```

- Produces `renderCoverThumbnail(file: File, mimeType: string, signal?: AbortSignal): Promise<Blob | null>` and `renderPdfPageThumbnails(file: File, signal?: AbortSignal): Promise<Blob[]>`.

- [ ] Write client tests with a fake Worker proving request-ID routing, concurrent response isolation, AbortSignal-to-cancel messaging, worker error rejection, lazy single-worker reuse, and disposal after a fatal worker error.
- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/thumbnail-worker-client.test.ts`. Expected: FAIL because the client does not exist.
- [ ] Implement the minimum lazy Worker client with a pending promise map. Do not add priorities, retries, or another queue.
- [ ] In the Worker, feature-detect `OffscreenCanvas` and `createImageBitmap`; report error code `background-rendering-unavailable` when absent.
- [ ] Move image cover and PDF cover/page render logic into the Worker. Use `OffscreenCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })`; return `Blob` or `Blob[]`, not data URLs.
- [ ] Keep browser `<video>` extraction in `thumbnail-generator.ts` and yield before/after its single-frame canvas encode.
- [ ] Make the public thumbnail generator delegate image/PDF work to the Worker so upload, cover jobs, local sync, and presentation readiness share one boundary.
- [ ] Re-run client and PDF queue tests. Expected: PASS and no renderer canvas is created for image/PDF cases.
- [ ] Commit with `feat: render thumbnails off the UI thread`.

### Task 3: Persist Worker blobs through existing media jobs

**Files:**

- Modify: `src/renderer/src/lib/thumbnail-db.ts`
- Modify: `src/renderer/src/lib/cover-thumbnail-jobs.ts`
- Modify: `src/renderer/src/lib/pdf-page-jobs.ts`
- Create: `src/renderer/src/lib/__tests__/thumbnail-jobs.test.ts`
- Modify: `src/renderer/src/lib/__tests__/thumbnail-db.test.ts`

**Interfaces:**

- Consumes: `renderCoverThumbnail()` and `renderPdfPageThumbnails()` from Task 2.
- Produces: `saveThumbnailBlob(sourceBlobId: string, blob: Blob): Promise<void>`; existing `savePdfPageThumbBlobs()` remains the PDF persistence path.

- [ ] Add failing tests proving cover jobs store a returned `Blob`, PDF jobs store `Blob[]`, and `background-rendering-unavailable` becomes the existing `MediaJobBlockedError('configuration')` state.
- [ ] Add a readiness test proving PDF page work is enqueued only when presentation readiness is requested and its completion is not required for folder upload success.
- [ ] Run focused media queue, PDF queue, and readiness suites. Expected: FAIL because jobs still expect data URLs and unsupported Worker capability is not classified.
- [ ] Add `saveThumbnailBlob()` beside the existing data-URL compatibility function; write directly to the current `cover-thumbnail` derived asset.
- [ ] Route cover/PDF executors to Blob APIs and pass the existing job AbortSignal to the Worker client.
- [ ] Map only `background-rendering-unavailable` to configuration-blocked; preserve other errors as failed jobs.
- [ ] Re-run focused suites. Expected: PASS with existing legacy thumbnail reads and cleanup unchanged.
- [ ] Commit with `fix: persist background thumbnail results`.

### Task 4: Synchronize stopwatch mode through the timer adapter

**Files:**

- Modify: `src/renderer/src/lib/timer-adapter.ts`
- Modify: `src/renderer/src/contexts/TimerEngineContext.tsx`
- Modify: `src/renderer/src/lib/__tests__/timer-adapter.test.ts`
- Modify: `src/renderer/src/contexts/__tests__/TimerEngineContext.test.tsx`
- Modify: `src/main/__tests__/timerService.test.ts`

**Interfaces:**

- Consumes: existing `TimerMode` and `{ type: 'setMode'; mode: TimerMode }` command.
- Produces: `TimerAdapter.syncMode(mode: TimerMode): void`.

- [ ] Add failing tests proving Electron `syncMode('stopwatch')` sends the existing setMode command, browser sync is a no-op, hydrated initial mode syncs after adapter creation, and later mode changes sync once.
- [ ] Add a TimerService boundary test that sets stopwatch mode, starts, advances fake time, and observes `mode: 'stopwatch'` plus positive `stopwatchElapsedMs` in the emitted tick.
- [ ] Run `npx vitest run src/renderer/src/lib/__tests__/timer-adapter.test.ts src/renderer/src/contexts/__tests__/TimerEngineContext.test.tsx src/main/__tests__/timerService.test.ts`. Expected: FAIL because mode never crosses the adapter boundary.
- [ ] Add `syncMode(mode)` to the existing adapter interface. Browser implementation is a no-op; Electron sends the validated existing command.
- [ ] In `TimerEngineProvider`, select renderer mode and call `adapter?.syncMode(mode)` from an effect depending on `adapter` and `mode`.
- [ ] Re-run the focused suites. Expected: PASS across initial mode, switching, StrictMode lifecycle, and existing stopwatch commands.
- [ ] Commit with `fix: synchronize Electron stopwatch mode`.

### Task 5: Verify runtime responsiveness

**Files:**

- Modify: `e2e/responsive-workspaces.spec.ts` only when existing browser helpers can cover the assertion without Electron-only scaffolding.
- Otherwise: attach manual Electron trace evidence to the PR.

- [ ] With a fresh HHC Presenter profile under `npm run dev`, import a mixed nested folder containing images, a multi-page PDF, MP4, MKV, and ignored system files.
- [ ] Run a visible 100 ms heartbeat and stopwatch with projection enabled before import; verify both control and projection continue advancing during persistence and PDF preparation.
- [ ] Verify upload count/folder structure, delayed PDF page generation, cover/poster availability, pause/resume/reset, and switching back to timer mode.
- [ ] Import at least 1,000 small supported files and capture a Performance trace. Acceptance: heartbeat repaint continues and no upload orchestration task exceeds 50 ms.
- [ ] If a renderer image/PDF decode/render/encode stack appears, stop and fix the boundary before PR creation.

### Task 6: Verify, create PR, wait for CI, and merge

**Files:**

- Review all changes against the spec and latest `origin/main`.

- [ ] Run all focused suites from Tasks 1-4.
- [ ] Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- [ ] Confirm `git diff --check` and inspect for unhandled promises, renderer image/PDF work, extra queues, mode drift, hard-coded profile paths, and unrelated VLC/rebrand changes.
- [ ] Push `fix/folder-upload-stopwatch` and create one PR against `main` with verification and manual-smoke evidence.
- [ ] Wait for every required CI check. If any fail, fix in the same worktree, rerun local verification, push, and wait again.
- [ ] Merge only after required CI is green. Do not create a tag, GitHub Release, package, updater manifest, or deployment.

## Plan self-review

- Folder enumeration, persistence scheduling, image/PDF rendering, and stopwatch mode drift each have an explicit boundary and failing test.
- Existing queue, Blob storage, async native copy, timer command, and projection bridge are reused.
- No foreground image/PDF fallback, new dependency, worker pool, second job queue, VLC change, release, or deployment is included.
