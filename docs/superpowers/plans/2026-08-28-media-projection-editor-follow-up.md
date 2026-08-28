# Media Projection and Presentation Editor Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct Media projection selection and lifecycle behavior, remove the confirmed native-PPT authorization error, improve first-click and folder-upload responsiveness, and align Presentation and sync-provider UI behavior.

**Architecture:** Keep media capability detection unchanged and add one playlist-selection policy at the existing presentability boundary. Preserve the native-fs trust boundary by passing an already-authorized projection source instead of granting projection renderers general file-stat permission. Reuse the existing window, upload, local-font, icon, and localization mechanisms; add no new coordinator, dependency, schema, or provider abstraction.

**Tech Stack:** Electron, React 19, TypeScript, Zustand, HeroUI v3, Tailwind CSS v4, Vitest/Testing Library, Playwright, electron-vite

**Spec:** `docs/superpowers/plans/2026-08-28-media-projection-editor-follow-up.md` — the Acceptance Contract below captures the approved 2026-08-28 investigation.

## Acceptance Contract

| Area                    | Required outcome                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty context menu      | No menu surface opens when the normalized entry list contains no actionable item.                                                                                                                                                  |
| Mixed folder projection | Folder or non-PPT projection excludes all presentations; explicitly projecting a PPT produces a one-item playlist containing only that PPT.                                                                                        |
| Presentation start      | A ready PPT start navigates to `/media`; an unready or failed start stays in the editor.                                                                                                                                           |
| Native PPT source       | Projection can read an already-authorized native PPT without calling the main-window-only `native-fs:file-exists` handler.                                                                                                         |
| First click             | On macOS, the first click delivered to an inactive control window performs the clicked action. Projection foregrounding still never calls `projectionWindow.focus()`.                                                              |
| Folder upload           | Folder creation and thumbnail work yield to the renderer so progress remains interactive; file order, naming, storage, and job semantics remain unchanged.                                                                         |
| Presentation editor     | Inserted text displays as 18 pt at every document width; the size list matches current Mac PowerPoint; the 1200×800 Home ribbon does not overflow; narrower layouts retain intentional horizontal scrolling.                       |
| Local fonts             | Existing user-triggered `queryLocalFonts()` remains the source of truth. Installed `BiauKaiTC`/標楷體 is selectable; exact `PMingLiU`/新細明體 is shown only where installed, with `Songti TC` as the documented macOS substitute. |
| Header alignment        | The Presentation projection action uses the same 8 px top/right inset and 40 px control size as the normal Header.                                                                                                                 |
| LINE/provider UI        | Folder badge, FAB, and context menu use the same existing official LINE asset; do not crop or recolor the artwork. Labels become `同步本地`, `同步 OneDrive`, and `同步 LINE 群組` in zh-TW.                                       |

## Global Constraints

- At execution time, create an isolated worktree and task branch from the latest `origin/main`; never implement directly on `main`.
- Preserve Electron/browser dual-mode behavior and the projection-owner rule.
- Do not change `isPresentable()` or make PPT globally non-presentable.
- Do not broaden native-fs import, stat, or delete authorization to arbitrary renderer windows.
- Do not modify the official LINE artwork. A cropped central-bubble derivative is excluded because it conflicts with the existing brand-asset contract; revisit only with explicit approval to accept that deviation.
- Add no dependency, persistence schema, font file, permission framework, upload worker, or speculative batching API.
- Follow RED-GREEN-REFACTOR for each behavioral task and keep commits reviewable by task.
- Stop before push, PR, merge, version bump, tag, release, or deployment unless separately authorized.

---

### Task 1: Suppress Empty Context Menus at the Shared Entry Point

**Files:**

- Modify: `src/renderer/src/contexts/ContextMenuContext.tsx:46-50`
- Test: `src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx`

**Interfaces:**

- Consumes: `ContextMenuEntry[]`, including separators
- Produces: unchanged `showMenu(items, event): void`, with no open state when no actionable entry remains

- [ ] **Step 1: Add failing normalization tests**

  Add tests that right-click with `[]` or `['separator']`. Assert `event.preventDefault()` still runs, no element with `role="menu"` appears, and an already-open menu closes when a later empty request is made.

  ```tsx
  fireEvent.contextMenu(screen.getByTestId('target'))

  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  ```

- [ ] **Step 2: Verify the tests fail for the current empty overlay**

  Run:

  ```bash
  npx vitest run src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx
  ```

  Expected: the empty request currently creates a menu container.

- [ ] **Step 3: Add the minimum shared guard**

  Clear the menu if no non-separator item remains. Keep the overlay's existing item extraction, but do not create an initially empty surface.

  ```ts
  const hasActionableItem = items.some((item) => item !== 'separator')
  if (!hasActionableItem) {
    setMenu(null)
    return
  }
  ```

- [ ] **Step 4: Re-run the focused test and commit**

  ```bash
  npx vitest run src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx
  git add src/renderer/src/contexts/ContextMenuContext.tsx src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx
  git commit -m "fix: suppress empty context menus"
  ```

### Task 2: Centralize the Mixed-Folder Projection Playlist Policy

**Files:**

- Modify: `src/renderer/src/lib/presentability.ts:64-73`
- Test: `src/renderer/src/lib/__tests__/presentability.test.ts`
- Modify: `src/renderer/src/components/Control/Header/Header.tsx:76-85`
- Test: `src/renderer/src/components/Control/Header/__tests__/Header.test.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/FileBrowser.tsx:750-779,989-1006`
- Test: `src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/useFileContextMenu.ts:25-101`
- Test: `src/renderer/src/components/Control/FileExplorer/__tests__/useFileContextMenu.test.tsx`
- Modify: `e2e/browser-projection.spec.ts`

**Interfaces:**

- Consumes: `AnyItemRecord[]`, optional requested `FileItemRecord`, optional `MediaPlatform`
- Produces: `getProjectionPlaylist(items, requestedItem?, platform?): FileItemRecord[]`

- [ ] **Step 1: Add failing policy tests**

  Cover one folder containing an image, video, PDF, PPTX, unsupported item, and subfolder. Assert:

  ```ts
  expect(getProjectionPlaylist(items).map(({ id }) => id)).toEqual(['image', 'video', 'pdf'])
  expect(getProjectionPlaylist(items, pptx).map(({ id }) => id)).toEqual(['pptx'])
  expect(getProjectionPlaylist(items, video).map(({ id }) => id)).toEqual(['image', 'video', 'pdf'])
  ```

  Preserve item order and the existing Electron/web capability filtering.

- [ ] **Step 2: Verify the focused test fails because PPTX remains in the folder playlist**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/presentability.test.ts
  ```

- [ ] **Step 3: Implement one playlist selector without changing capability detection**

  Add this interface beside `getPresentableItems()`:

  ```ts
  export function getProjectionPlaylist(
    items: AnyItemRecord[],
    requestedItem?: FileItemRecord,
    platform = getPresentabilityPlatform()
  ): FileItemRecord[]
  ```

  Its behavior is:

  ```ts
  const presentable = getPresentableItems(items, platform)
  if (requestedItem && getMediaType(requestedItem.mimeType, platform) === 'presentation') {
    return presentable.filter((item) => item.id === requestedItem.id)
  }
  return presentable.filter((item) => getMediaType(item.mimeType, platform) !== 'presentation')
  ```

- [ ] **Step 4: Route every folder and direct-file start through the policy**

  Use `getProjectionPlaylist(folderItems)` in Header/folder projection and `getProjectionPlaylist(sortedItems, requestedItem)` for direct item starts. After filtering, always recompute the start index from the returned playlist:

  ```ts
  const playlist = getProjectionPlaylist(items, requestedItem)
  const startIndex = requestedItem
    ? playlist.findIndex((entry) => entry.id === requestedItem.id)
    : 0
  if (startIndex < 0) return
  ```

  Change the internal context-menu `project()` helper to receive `requestedItem?: FileItemRecord`, not an index calculated from the unfiltered list. For FileBrowser Shift+F5, resolve the selected `FileItemRecord` first and pass it to the selector; use `undefined` only when no item is selected. Use the filtered Header list for both disabled-state calculation and startup input, so a folder containing only PPT files does not expose folder projection. Keep Presentation Workspace, search-result PPT open, and Service Cue single-item calls unchanged.

- [ ] **Step 5: Add caller regression tests**

  Assert Header, FileBrowser double-click/Shift+F5, file context action, and folder context action send the exact expected playlist and recomputed start index. Put multiple non-PPT items before the selected PPT and verify right-click Project and Shift+F5 both send `[ppt]` at index `0`. Also assert Header is disabled for a folder containing only PPT files.

  Add a browser E2E fixture with image/video/PDF/PPT in one folder. Start folder projection and assert the live media playlist contains no PPT entry.

- [ ] **Step 6: Run the focused suite and commit**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/presentability.test.ts \
    src/renderer/src/components/Control/Header/__tests__/Header.test.tsx \
    src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx \
    src/renderer/src/components/Control/FileExplorer/__tests__/useFileContextMenu.test.tsx
  git add src/renderer/src/lib/presentability.ts src/renderer/src/lib/__tests__/presentability.test.ts src/renderer/src/components/Control/Header/Header.tsx src/renderer/src/components/Control/Header/__tests__/Header.test.tsx src/renderer/src/components/Control/FileExplorer/FileBrowser.tsx src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx src/renderer/src/components/Control/FileExplorer/useFileContextMenu.ts src/renderer/src/components/Control/FileExplorer/__tests__/useFileContextMenu.test.tsx e2e/browser-projection.spec.ts
  git commit -m "fix: isolate presentations from media playlists"
  ```

### Task 3: Enter Media Controls Only After a Ready Presentation Start

**Files:**

- Modify: `src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx:123-158`
- Test: `src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx`
- Modify: `e2e/browser-projection.spec.ts`

**Interfaces:**

- Consumes: existing `PresentationReadinessReport` from `startMediaProjection()`
- Produces: navigation to `/media` only when the requested presentation entry has `status: 'ready'`

- [ ] **Step 1: Add failing navigation tests**

  Replace the existing summary-only default mock with a complete `makeReadinessReport(item, status)` fixture containing `items` plus every summary field. Mock three valid reports: requested PPT ready, requested PPT failed, and zero ready items. Assert only the ready report calls `navigate('/media')`; rejection keeps the current editor route and existing toast behavior.

  ```ts
  mocks.startMediaProjection.mockResolvedValue(readyReport)
  await user.click(screen.getByRole('button', { name: 'Start projection' }))
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/media'))
  ```

- [ ] **Step 2: Verify the ready-case test fails**

  ```bash
  npx vitest run src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx
  ```

- [ ] **Step 3: Check readiness before navigation**

  Await the current call and inspect the requested item rather than navigating on `summary.ready > 0` alone:

  ```ts
  const report = await startMediaProjection(/* existing arguments */)
  const requested = report.items.find((entry) => entry.itemId === item.id)
  if (requested?.status === 'ready') navigate('/media')
  ```

  Keep the existing one-item playlist and `presentationState` payload unchanged. The button, F5, and Shift+F5 share this path; retain at least one shortcut success test proving it also waits for the requested item to be ready.

  Extend `e2e/browser-projection.spec.ts`: open a PPT in Presentation Workspace, press Start projection, and assert navigation reaches `/media` only after the PPT surface reports ready.

- [ ] **Step 4: Re-run the test and commit**

  ```bash
  npx vitest run src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx
  git add src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx e2e/browser-projection.spec.ts
  git commit -m "fix: enter media controls after presentation start"
  ```

### Task 4: Remove the Projection PPT Native-Stat Authorization Violation

**Files:**

- Modify: `src/renderer/src/lib/presentation-source.ts:24-45`
- Test: `src/renderer/src/lib/__tests__/presentation-source.test.ts`
- Modify: `src/renderer/src/components/Common/PptxSlideSurface.tsx:10-59`
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx:817-831`
- Test: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`
- Verify only: `src/main/ipc/native-fs.ts:201-210`
- Verify only: `src/main/__tests__/ipc/native-fs.test.ts`

**Interfaces:**

- Consumes: existing `GetFileSourceOptions.verifyNativeFile`
- Produces: `readPresentationArrayBuffer(source, options?)` and `PptxSlideSurface` opt-out used only by the projection route

- [ ] **Step 1: Add failing source-option tests**

  Assert the default editor call still verifies native availability and the explicit projection call forwards `{ verifyNativeFile: false }` to `getFileSource()`.

  ```ts
  const source = {
    id: 'copied-item',
    url: 'blob:source-blob',
    mimeType: PPTX_MIME_TYPE
  }
  await readPresentationArrayBuffer(source, { verifyNativeFile: false })
  expect(mocks.getFileSource).toHaveBeenCalledWith(
    expect.anything(),
    getBlobId(source),
    source.mimeType,
    { verifyNativeFile: false }
  )
  ```

- [ ] **Step 2: Verify the option test fails with the current fixed signature**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/presentation-source.test.ts
  ```

- [ ] **Step 3: Thread the existing verification option through the PPT surface**

  Add no new IPC. Use these signatures:

  ```ts
  export async function readPresentationArrayBuffer(
    sourceItem: PresentationSource,
    options: GetFileSourceOptions = {}
  ): Promise<ArrayBuffer>

  interface PptxSlideSurfaceProps {
    // existing props
    verifyNativeFile?: boolean
  }
  ```

  Pass `{ verifyNativeFile }` to `getFileSource()`. In `FileProjection`, set `verifyNativeFile={false}` because readiness already authorized and prepared the native item. Do not set it in the editor/preview callers. The tests must use `id !== getBlobId(source)` and also prove the default call, without `false`, retains native availability verification.

- [ ] **Step 4: Add the projection regression test**

  Render a native PPT payload and assert `PptxSlideSurface` receives `verifyNativeFile={false}` while the normal native-fs handler test still rejects projection-window callers.

- [ ] **Step 5: Run the trust-boundary suite and commit**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/presentation-source.test.ts \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx \
    src/main/__tests__/ipc/native-fs.test.ts
  git add src/renderer/src/lib/presentation-source.ts src/renderer/src/lib/__tests__/presentation-source.test.ts src/renderer/src/components/Common/PptxSlideSurface.tsx src/renderer/src/components/Projection/FileProjection.tsx src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
  git commit -m "fix: reuse authorized PPT source in projection"
  ```

### Task 5: Deliver the First Click to the macOS Control Window

**Files:**

- Modify: `src/main/windowManager.ts:71-91`
- Test: `src/main/__tests__/windowManager.test.ts`

**Interfaces:**

- Consumes: Electron `BrowserWindowConstructorOptions.acceptFirstMouse`
- Produces: main control window accepts a mouse-down that also activates it; projection foreground behavior remains unchanged

- [ ] **Step 1: Add a failing constructor-option test**

  ```ts
  wm.createMainWindow()
  expect(FakeBrowserWindow.instances[0].options).toMatchObject({
    acceptFirstMouse: true
  })
  ```

  Keep the existing assertions that `bringProjectionToFront()` calls neither `focus()` nor `setAlwaysOnTop()`.

- [ ] **Step 2: Verify the focused test fails**

  ```bash
  npx vitest run src/main/__tests__/windowManager.test.ts
  ```

- [ ] **Step 3: Use the native one-option fix**

  Add `acceptFirstMouse: true` only to the main control `BrowserWindow` constructor. Do not focus the main window after every projection update and do not change projection window z-order semantics.

- [ ] **Step 4: Run tests and perform the required macOS smoke**

  ```bash
  npx vitest run src/main/__tests__/windowManager.test.ts
  ```

  Manual smoke on macOS:
  1. Start an image/video with a newly created projection window and click a control exactly once.
  2. Repeat with an already-open projection window.
  3. Repeat with PPT and on both one-display and two-display setups when available.
  4. Confirm the clicked action fires once, keyboard focus is not trapped, and the projection remains visible.

  Stop this task if `acceptFirstMouse` does not change the reproduced behavior; capture main/projection `focus` and `blur` events before proposing another production change.

- [ ] **Step 5: Commit only after the smoke passes**

  ```bash
  git add src/main/windowManager.ts src/main/__tests__/windowManager.test.ts
  git commit -m "fix: accept the first control window click"
  ```

### Task 6: Yield During Folder Upload Without Changing Upload Semantics

**Files:**

- Modify: `src/renderer/src/lib/thumbnail-generator.ts:10-13`
- Modify: `src/renderer/src/lib/upload-utils.ts:231-275,277-350`
- Test: `src/renderer/src/lib/__tests__/upload-utils.test.ts`
- Test: `src/renderer/src/lib/__tests__/thumbnail-generator.test.ts`

**Interfaces:**

- Consumes/produces: export existing `yieldToMain(): Promise<void>`; no upload API signature changes
- Produces: one renderer yield after each created folder and before CPU-heavy thumbnail canvas serialization

- [ ] **Step 1: Add failing yield tests for both folder entry paths**

  Extend the thumbnail mock with `yieldToMain: vi.fn().mockResolvedValue(undefined)`. For `uploadFolderFiles()` and `uploadFromDataTransfer()`, construct nested paths and assert one yield per newly created folder, with no yield for a duplicate path.

  ```ts
  expect(yieldToMain).toHaveBeenCalledTimes(createdFolderCount)
  ```

- [ ] **Step 2: Verify current folder creation never yields**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/upload-utils.test.ts
  ```

- [ ] **Step 3: Reuse the existing renderer-yield implementation**

  Export the current `yieldToMain` from `thumbnail-generator.ts`. After each successful `addFolder(...)` call in both folder-building loops, await it before continuing. Do not alter naming, parent resolution, persistence ordering, upload concurrency, or return counts.

- [ ] **Step 4: Yield before synchronous canvas serialization**

  Call `await yieldToMain()` immediately before every synchronous `drawContainFit()`/`toDataURL()` section in the image path, `generatePdfThumbnail()`, and every page of `generateAllPdfPageThumbnails()`. Keep the existing post-render/post-page yields and all media-job behavior. Add an ordered test proving the first yield happens before the first `toDataURL()`, not merely that both functions were called.

- [ ] **Step 5: Run focused tests and an interactive stress smoke**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/upload-utils.test.ts \
    src/renderer/src/lib/__tests__/thumbnail-generator.test.ts
  ```

  Import a representative folder containing at least 50 nested folders and a mixed set of images/PDFs. While upload runs, move the pointer and operate a harmless view control. Confirm the UI repaints and accepts input, every accepted file appears once, and deferred thumbnails eventually arrive.

- [ ] **Step 6: Commit**

  ```bash
  git add src/renderer/src/lib/thumbnail-generator.ts src/renderer/src/lib/upload-utils.ts src/renderer/src/lib/__tests__/upload-utils.test.ts src/renderer/src/lib/__tests__/thumbnail-generator.test.ts
  git commit -m "fix: keep folder uploads responsive"
  ```

### Task 7: Align Presentation Text, Fonts, Ribbon, and Header Geometry

**Files:**

- Modify: `src/renderer/src/lib/editable-presentation.ts:168-172`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx:120-121,1404-1503`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`
- Modify: `src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx:216-355`
- Test: `src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx`
- Modify: `e2e/responsive-workspaces.spec.ts`

**Interfaces:**

- Produces: `INSERTED_TEXT_FONT_SIZE_POINTS = 18`, converted to canvas pixels for the current document width
- Produces: curated preset list observed in local PowerPoint for Mac on 2026-08-28: `[8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96]`
- Preserves: existing user-triggered local-font permission flow and stored font-family strings

- [ ] **Step 1: Add failing text-default and size-list tests**

  Assert a newly inserted text element round-trips to 18 pt at both 1920 px and 1280 px document widths, and the Font Size combobox options exactly match:

  ```ts
  const expected = [
    8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96
  ]
  ```

- [ ] **Step 2: Apply the 18 pt semantic constant and preserve point-to-canvas conversion**

  Rename the current canvas-pixel constant to:

  ```ts
  export const INSERTED_TEXT_FONT_SIZE_POINTS = 18
  ```

  In `createTextElement()`, use `presentationPointsToCanvasPx(INSERTED_TEXT_FONT_SIZE_POINTS, DEFAULT_WIDTH)` for its standard-document default. In `PresentationWorkspacePage.addTextElement()`, calculate the current-document font size once and ensure interactive click/drag frames cannot retain the old 32/40 px height:

  ```ts
  const fontSize = presentationPointsToCanvasPx(INSERTED_TEXT_FONT_SIZE_POINTS, document.width)
  const textHeight = Math.max(height, Math.ceil(fontSize * 1.15))
  ```

  Pass `fontSize` and `textHeight` to `createTextElement()`. Then replace `FONT_SIZES` with the exact curated list above. Do not change the existing 6–240 pt manual grow/shrink limits or the conversion functions. Tests at 1920 px and 1280 px must assert both the 18 pt round-trip and `height >= Math.ceil(fontSize * lineHeight)`.

- [ ] **Step 3: Add failing local-font expectations**

  Mock `queryLocalFonts()` with `BiauKaiTC`, `Songti TC`, and duplicates. Assert the user-triggered load exposes the installed families once and retains an imported `PMingLiU` family even when that font is not enumerated locally. Do not add unavailable fonts to the default picker or request permission on page load.

- [ ] **Step 4: Reflow the Font ribbon group**

  Replace the fixed overflowing first row with:
  - Group width `w-[440px]`.
  - Row 1: font family `min-w-44 flex-1`, local-font refresh, size `w-20`, increase and decrease.
  - Row 2: bold, italic, underline, color controls, and clear formatting.
  - Keep every control's current accessible name, disabled state, and action.

  Leave Paragraph, Position, and Arrange group widths unchanged. Their total with Font becomes 984 px, fitting the observed 1020 px ribbon viewport at 1200×800.

- [ ] **Step 5: Align the Presentation Header action area**

  Change the outer header to `h-14 items-center px-2`. Remove `mb-1` from non-tab actions and the right action wrapper; give document tabs `self-end` so only the tabs remain bottom-aligned. Keep the projection button at `size-10 min-w-10`.

- [ ] **Step 6: Strengthen responsive E2E coverage**

  Update `responsive-workspaces.spec.ts` to assert:

  ```ts
  await page.setViewportSize({ width: 1200, height: 800 })
  expect(await ribbon.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  ```

  Also keep a 900 px assertion where horizontal ribbon scrolling remains available. Measure the Presentation projection button and normal Header projection button in separate route states and require the same 8 px top/right inset with a 1 px tolerance.

- [ ] **Step 7: Run focused unit and browser tests**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/editable-presentation.test.ts \
    src/renderer/src/lib/__tests__/local-fonts.test.ts \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx \
    src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx
  npm run build
  npx playwright test e2e/responsive-workspaces.spec.ts
  ```

- [ ] **Step 8: Perform the required Electron font smoke and commit**

  In Electron, click Load Local Fonts, grant permission if prompted, and verify `BiauKaiTC` can be selected and appears in both editor and projection. On this Mac, verify `Songti TC` is available as the 新細明體 substitute; do not claim exact `PMingLiU` availability unless it is installed. Record the tested PowerPoint for Mac version and a screenshot of its preset dropdown as verification evidence for the curated list; do not describe the closed preset list as full PowerPoint font-size compatibility.

  ```bash
  git add src/renderer/src/lib/editable-presentation.ts src/renderer/src/lib/__tests__/editable-presentation.test.ts src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx e2e/responsive-workspaces.spec.ts
  git commit -m "fix: align presentation editor controls"
  ```

### Task 8: Synchronize Provider Icons and Menu Copy

**Files:**

- Modify: `src/renderer/src/lib/createFolderContextMenu.ts:375-406`
- Test: `src/renderer/src/lib/__tests__/createFolderContextMenu.test.tsx`
- Modify: `src/renderer/src/contexts/ContextMenuContext.tsx:4-11`
- Modify: `src/renderer/src/components/Common/ContextMenuOverlay.tsx:105-131`
- Test: `src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx`
- Verify/modify if required: `src/renderer/src/components/icons/LineBrandIcon.tsx`
- Modify: `src/renderer/src/components/icons/SyncProviderIcon.tsx:11-18`
- Test: `src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx`
- Test: `src/renderer/src/components/Control/FileExplorer/__tests__/FileExplorerFAB.test.tsx`
- Modify: `src/renderer/src/locales/zh-TW.json:517-519`
- Modify: `src/renderer/src/locales/zh-CN.json:517-519`
- Modify: `src/renderer/src/locales/en.json:517-519`

**Interfaces:**

- Consumes: existing `SyncProviderIcon({ providerType })` and optional `ContextMenuItem.iconSlotClassName`
- Produces: identical LINE provider artwork in folder badge, FAB, and context-menu action

- [ ] **Step 1: Add failing icon-consistency tests**

  Assert the `add-hhc-line` context action renders `LineBrandIcon`/the `line-brand-icon` image instead of `lucide-cloud`. Render the real overlay and prove the LINE item receives a 40×40 icon slot, does not clip the 40×40 protected brand box, and leaves normal menu icon slots at 16×16. Keep the existing tests that reject recoloring, backgrounds, masks, animation, and other caller visual effects.

- [ ] **Step 2: Replace only the stale context-menu glyph**

  Extend `ContextMenuItem` with one optional layout field and keep the default unchanged:

  ```ts
  iconSlotClassName?: string
  ```

  In `ContextMenuOverlay`, use `entry.iconSlotClassName ?? 'h-4 w-4'` for the icon slot. Configure only the HHC LINE action:

  ```ts
  icon: React.createElement(SyncProviderIcon, { providerType: 'hhc-line' }),
  iconSlotClassName: 'size-10'
  ```

  Keep the existing `LineBrandIcon` asset and clear-space behavior. Do not create a cropped or green-background-free derivative in this task.

- [ ] **Step 3: Apply locale copy consistently**

  Use these values:

  ```json
  {
    "addLocalSyncFolder": "同步本地",
    "addOneDrive": "同步 OneDrive",
    "addHhcLine": "同步 LINE 群組"
  }
  ```

  Translate the same action semantics in the other shipped locales:
  - en: `Sync local folder`, `Sync OneDrive`, `Sync LINE group`
  - zh-CN: `同步本地`, `同步 OneDrive`, `同步 LINE 群组`

- [ ] **Step 4: Update copy-dependent tests and run the focused suite**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/createFolderContextMenu.test.tsx \
    src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx \
    src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx \
    src/renderer/src/components/Control/FileExplorer/__tests__/FileExplorerFAB.test.tsx
  ```

- [ ] **Step 5: Visually verify all three placements and commit**

  Check folder badge, lower-right FAB, and empty-area context menu in light and dark themes. Confirm the image is identical, not clipped, and does not receive a colored wrapper from the caller.

  ```bash
  git add src/renderer/src/lib/createFolderContextMenu.ts src/renderer/src/lib/__tests__/createFolderContextMenu.test.tsx src/renderer/src/contexts/ContextMenuContext.tsx src/renderer/src/components/Common/ContextMenuOverlay.tsx src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx src/renderer/src/components/icons/LineBrandIcon.tsx src/renderer/src/components/icons/SyncProviderIcon.tsx src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx src/renderer/src/components/Control/FileExplorer/__tests__/FileExplorerFAB.test.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
  git commit -m "fix: align sync provider actions"
  ```

### Task 9: Run Integrated Dual-Mode Verification

**Files:**

- Review all changed files against this Acceptance Contract and `origin/main`.

- [ ] **Step 1: Run the focused regression set**

  ```bash
  npx vitest run \
    src/renderer/src/contexts/__tests__/ContextMenuContext.test.tsx \
    src/renderer/src/lib/__tests__/presentability.test.ts \
    src/renderer/src/lib/__tests__/presentation-source.test.ts \
    src/renderer/src/lib/__tests__/upload-utils.test.ts \
    src/renderer/src/lib/__tests__/thumbnail-generator.test.ts \
    src/renderer/src/lib/__tests__/editable-presentation.test.ts \
    src/renderer/src/lib/__tests__/local-fonts.test.ts \
    src/renderer/src/lib/__tests__/createFolderContextMenu.test.tsx \
    src/renderer/src/components/Control/Header/__tests__/Header.test.tsx \
    src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx \
    src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx \
    src/renderer/src/components/Control/FileExplorer/__tests__/useFileContextMenu.test.tsx \
    src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx \
    src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx \
    src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx \
    src/renderer/src/components/Control/FileExplorer/__tests__/FileExplorerFAB.test.tsx \
    src/main/__tests__/ipc/native-fs.test.ts \
    src/main/__tests__/windowManager.test.ts
  ```

- [ ] **Step 2: Run repository gates**

  ```bash
  npm test
  npm run lint
  npm run typecheck
  npm run build
  git diff --check
  ```

- [ ] **Step 3: Run browser-mode E2E**

  ```bash
  npm run test:e2e:browser
  ```

  Verify the new browser regressions prove mixed-folder projection excludes PPT and explicit PPT enters `/media` only after readiness. Empty/separator-only context requests remain covered at the shared provider unit boundary because no production UI should intentionally emit such a request after Task 1.

- [ ] **Step 4: Run Electron smoke**

  Exercise:
  1. Mixed image/video/PDF/PPT folder projection.
  2. Explicit local native PPT projection with no `Unauthorized native file stat` log.
  3. First-click delivery on new and existing projection windows.
  4. Large nested folder upload while operating the UI.
  5. Presentation 18 pt insertion, full size list, 1200×800 ribbon, local font selection, and aligned projection button.
  6. LINE icon/copy in folder, FAB, and context menu.

- [ ] **Step 5: Review scope and report gates**

  ```bash
  git status --short
  git diff --stat origin/main...HEAD
  git log --oneline origin/main..HEAD
  ```

  Separate automated results, browser observation, Electron observation, and any unavailable hardware/font condition. Do not claim release or installed-device delivery.

## Stop Conditions

- Stop if any folder or non-PPT action can still place a PPT in its playlist.
- Stop if a failed/unready presentation start navigates away from the editor.
- Stop if the projection renderer needs broader native-fs permissions to read a prepared PPT.
- Stop Task 5 if the first-click issue persists; gather focus/blur evidence instead of stacking window-focus calls.
- Stop Task 6 if responsiveness improves only by changing upload ordering, dropping thumbnails, or losing persistence guarantees.
- Stop before UI acceptance if the 1200×800 ribbon still scrolls or if the 900 px layout loses access to clipped controls.
- Stop if LINE artwork is modified, recolored, masked, or decorated.
- Stop before PR/release for any failing focused test, full gate, browser E2E, or required Electron smoke.
