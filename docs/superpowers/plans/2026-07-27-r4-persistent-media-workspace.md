# R4 Persistent Media Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the routed Media operator workspace from the live projection session so the
operator can browse and safely preview files without interrupting output.

**Architecture:** The R3 coordinator remains the single projection snapshot authority and gains a
replayable intentional-blackout bit plus a narrow session summary. A globally mounted Media bridge
owns live synchronization while `/media` and nested `/files/preview/:itemId` own operator UI only.
The existing Media Zustand store retains live playlist and resource-lock state; preview runtime
state stays route-local.

**Tech Stack:** Electron 39, React 19, React Router, TypeScript, Zustand, HeroUI v3, Vite,
Vitest, Playwright

## Global Constraints

- No new dependency.
- Leaving `/media` sends no projection command and releases no live resource.
- Preview never calls a projection API before explicit Present.
- Stop Content is replayable intentional blackout, not `DefaultProjection`.
- Close Projection clears coordinator and Media live state exactly once.
- Explicit Present may bring projection forward once; blackout, resume, route navigation, reload,
  and passive synchronization never foreground it.
- The R3 5-second readiness timeout and one-crash-per-30-second policy remain unchanged.
- Browser and Electron share coordinator, route, and state semantics.
- Use HeroUI v3 compound APIs and localized accessible labels.
- Keep source code formatting at no semicolons, single quotes, 100-column width, and 2 spaces.

---

### Task 1: Add Replayable Intentional Blackout

**Files:**

- Modify: `src/shared/projection-messages.ts`
- Modify: `src/main/ipc/validate.ts`
- Modify: `src/main/__tests__/ipc/validate.test.ts`
- Modify: `src/renderer/src/lib/projection-session-coordinator.ts`
- Modify: `src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts`
- Modify: `src/renderer/src/lib/projection-render-state.ts`
- Modify: `src/renderer/src/lib/__tests__/projection-render-state.test.ts`
- Modify: `src/renderer/src/pages/ProjectionPage.tsx`
- Modify: `src/renderer/src/pages/__tests__/ProjectionPage.test.tsx`

**Interfaces:**

- Add `isBlackout: boolean` to `ProjectionSessionSnapshot`.
- Add `SystemMessages['__system:blackout'] = { enabled: boolean }`.
- Add `ProjectionSessionCoordinator.blackout(enabled: boolean): void`.
- Add `ProjectionRenderState.isBlackout: boolean`.

- [ ] **Step 1: Write failing coordinator and renderer tests**

Add assertions equivalent to:

```ts
coordinator.startSession('media', [['file:show', filePayload]])
coordinator.blackout(true)
coordinator.beginGeneration({ generation: 2, status: 'opening', reason: 'reload' })
coordinator.ready(2)

expect(send).toHaveBeenLastCalledWith('__system:replay', {
  generation: 2,
  snapshot: expect.objectContaining({ isBlackout: true })
})
```

And:

```ts
const state = reduceProjectionRenderState(projectingState, {
  type: 'message',
  channel: '__system:blackout',
  data: { enabled: true }
})
expect(selectVisibleProjection(state)).toBe('blackout')
```

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx src/main/__tests__/ipc/validate.test.ts
```

Expected: missing blackout contract and render-state failures.

- [ ] **Step 3: Implement shared contract, strict validation, and coordinator reduction**

Use:

```ts
blackout(enabled) {
  if (!snapshot) return
  snapshot = { ...snapshot, isBlackout: enabled }
  if (recovery.status === 'ready') send('__system:blackout', { enabled })
  notify()
}
```

`createEmptySnapshot()` initializes `isBlackout: false`. `startSession()` creates visible content.
`claim(owner, true)` clears both `showDefault` and `isBlackout`. Replay payload validation requires
`isBlackout` to be boolean.

- [ ] **Step 4: Render a dedicated black output**

Subscribe to `__system:blackout` in `ProjectionPage`. When selected output is `blackout`, render:

```tsx
<div className="h-screen w-screen bg-black" data-testid="projection-blackout" />
```

The VLC stop effect includes `state.isBlackout`. Do not render `DefaultProjection` for this branch.

- [ ] **Step 5: Run Task 1 tests and typecheck**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx src/main/__tests__/ipc/validate.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/projection-messages.ts src/main/ipc/validate.ts src/main/__tests__/ipc/validate.test.ts src/renderer/src/lib/projection-session-coordinator.ts src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/renderer/src/lib/projection-render-state.ts src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/pages/ProjectionPage.tsx src/renderer/src/pages/__tests__/ProjectionPage.test.tsx
git commit -m "feat: add replayable projection blackout"
```

---

### Task 2: Expose Projection Session Summary and Lifecycle Commands

**Files:**

- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`

**Interfaces:**

```ts
export interface ProjectionSessionSummary {
  owner: ProjectionOwner | null
  status: 'closed' | 'opening' | 'connected' | 'projecting' | 'failed'
  label: string | null
  isBlackout: boolean
  failure: ProjectionFailure | null
}
```

Add:

```ts
blackoutProjection: (enabled: boolean) => Promise<void>
getProjectionSnapshot: () => ProjectionSessionSnapshot | null
```

`degraded` is added in Task 6 because it consumes Media readiness state outside the context.

- [ ] **Step 1: Write failing context tests**

Cover:

- `blackoutProjection(true)` stops VLC, preserves the window, and does not call foreground.
- `blackoutProjection(false)` preserves generation and does not call foreground.
- summary maps closed, opening/recovering, ready-content, ready-blackout, and failed.
- close clears the summary and coordinator snapshot.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
```

- [ ] **Step 3: Implement summary derivation and blackout command**

Derive summary only from `recovery`, `isProjectionOpen`, and `coordinator.getSnapshot()`. Use the
active `file:show.fileName`, Bible reference, or localized owner label later in the mini bar; the
context returns raw safe label data without importing i18n.

```ts
const blackoutProjection = useCallback(async (enabled: boolean): Promise<void> => {
  if (enabled) await window.api?.projectionVlc?.stop?.().catch(() => {})
  getCoordinator().blackout(enabled)
  setIsProjectionBlanked(enabled)
}, [getCoordinator])
```

Do not call `bringProjectionToFront()`.

- [ ] **Step 4: Run context tests and typecheck**

```bash
npx vitest run src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/contexts/ProjectionContext.tsx src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
git commit -m "feat: expose projection session controls"
```

---

### Task 3: Make Media Live Synchronization Route-Independent

**Files:**

- Create: `src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx`
- Create: `src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx`
- Modify: `src/renderer/src/components/Control/Layout.tsx`
- Modify: `src/renderer/src/components/Control/__tests__/Layout.test.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/MediaPresenter.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/__tests__/MediaPresenterKeyboard.test.tsx`
- Modify: `src/renderer/src/lib/media-projection-sync.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-sync.test.ts`
- Modify: `src/renderer/src/stores/media-projection.ts`
- Modify: `src/renderer/src/stores/__tests__/media-projection.test.ts`

**Interfaces:**

Add Media store actions:

```ts
endLiveSession: () => void
markProjectionClosed: () => void
```

`exit()` is removed after call sites migrate. Route navigation does not call either action.

- [ ] **Step 1: Write failing lifecycle tests**

Prove:

- unmounting `MediaPresenter` does not call `stopProjection`;
- the bridge continues `file:show`, pan, zoom, and playback subscriptions while `/media` is not
  rendered;
- `markProjectionClosed()` releases locks and resets live state without another close request;
- false `isPresenting` no longer automatically closes projection.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/renderer/src/components/Control/FileExplorer/Presenter/__tests__/MediaPresenterKeyboard.test.tsx src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/lib/__tests__/media-projection-sync.test.ts src/renderer/src/stores/__tests__/media-projection.test.ts
```

- [ ] **Step 3: Implement the global bridge**

`MediaProjectionBridge` calls `useMediaProjectionSync()` and subscribes to
`file:playback-state`. Move those effects out of `MediaPresenter`. Mount the bridge next to
`TimerProjectionBridge`.

- [ ] **Step 4: Remove route-unmount cleanup**

Delete the `MediaPresenter` effect whose cleanup calls `stopProjection()`. Change Escape's final
action to route navigation in Task 4; until then pass a navigation-only `onExit`.

Change `media-projection-sync.ts` so a store transition to inactive does not close the window.
Explicit commands own blackout and close.

- [ ] **Step 5: Run focused tests and typecheck**

```bash
npx vitest run src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/components/Control/FileExplorer/Presenter/__tests__/MediaPresenterKeyboard.test.tsx src/renderer/src/lib/__tests__/media-projection-sync.test.ts src/renderer/src/stores/__tests__/media-projection.test.ts src/renderer/src/components/Control/__tests__/Layout.test.tsx
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/components/Control/Layout.tsx src/renderer/src/components/Control/__tests__/Layout.test.tsx src/renderer/src/components/Control/FileExplorer/Presenter/MediaPresenter.tsx src/renderer/src/components/Control/FileExplorer/Presenter/__tests__/MediaPresenterKeyboard.test.tsx src/renderer/src/lib/media-projection-sync.ts src/renderer/src/lib/__tests__/media-projection-sync.test.ts src/renderer/src/stores/media-projection.ts src/renderer/src/stores/__tests__/media-projection.test.ts
git commit -m "refactor: keep media projection outside routes"
```

---

### Task 4: Replace the Fixed Presenter Overlay with `/media`

**Files:**

- Create: `src/renderer/src/pages/MediaWorkspacePage.tsx`
- Create: `src/renderer/src/pages/__tests__/MediaWorkspacePage.test.tsx`
- Modify: `src/renderer/src/router.tsx`
- Modify: `src/renderer/src/__tests__/router.test.tsx`
- Modify: `src/renderer/src/components/Control/Layout.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/MediaPresenter.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/PresenterHeader.tsx`

**Interfaces:**

- Add route `/media`.
- Change `MediaPresenter` to a normal full-height workspace without `fixed inset-0 z-9999`.
- `PresenterHeader.onExit` means Back to Files only.

- [ ] **Step 1: Write failing route and navigation tests**

Assert:

- `/media` renders Media Workspace under `Layout`;
- Back to Files navigates to `/files`;
- Back to Files sends no `stopProjection`, `closeProjection`, or blackout command;
- the old conditional overlay is absent from `Layout`.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/renderer/src/pages/__tests__/MediaWorkspacePage.test.tsx src/renderer/src/__tests__/router.test.tsx src/renderer/src/components/Control/__tests__/Layout.test.tsx
```

- [ ] **Step 3: Implement route and workspace shell**

Use:

```tsx
export default function MediaWorkspacePage(): React.JSX.Element {
  const navigate = useNavigate()
  const isPresenting = useMediaProjectionStore((state) => state.isPresenting)

  useEffect(() => {
    if (!isPresenting) navigate('/files', { replace: true })
  }, [isPresenting, navigate])

  return <MediaPresenter onExit={() => navigate('/files')} />
}
```

The route remains inside `Layout`. Treat `/media` like Presentation Workspace for `main`
overflow, but retain the standard global sidebar unless responsive evidence requires hiding it.

- [ ] **Step 4: Run tests and typecheck**

```bash
npx vitest run src/renderer/src/pages/__tests__/MediaWorkspacePage.test.tsx src/renderer/src/__tests__/router.test.tsx src/renderer/src/components/Control/__tests__/Layout.test.tsx
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/MediaWorkspacePage.tsx src/renderer/src/pages/__tests__/MediaWorkspacePage.test.tsx src/renderer/src/router.tsx src/renderer/src/__tests__/router.test.tsx src/renderer/src/components/Control/Layout.tsx src/renderer/src/components/Control/FileExplorer/Presenter/MediaPresenter.tsx src/renderer/src/components/Control/FileExplorer/Presenter/PresenterHeader.tsx
git commit -m "feat: route the media workspace"
```

---

### Task 5: Add Nested Safe File Preview

**Files:**

- Create: `src/renderer/src/components/Control/FileExplorer/Preview/FilePreviewInspector.tsx`
- Create: `src/renderer/src/components/Control/FileExplorer/Preview/__tests__/FilePreviewInspector.test.tsx`
- Modify: `src/renderer/src/pages/FilesPage.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/FileBrowser.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx`
- Modify: `src/renderer/src/router.tsx`
- Modify: `src/renderer/src/__tests__/router.test.tsx`

**Interfaces:**

- Nested route: `/files/preview/:itemId`.
- `FilePreviewInspector` receives the resolved `FileItemRecord`.
- `onPresent(item)` calls `startMediaProjection(..., { prioritizeStartItem: true })`.

- [ ] **Step 1: Write failing double-click and preview-isolation tests**

Prove:

- folder double-click still navigates into the folder;
- editable presentation double-click opens its editor;
- image/video/PDF/imported-presentation double-click navigates to safe preview;
- loading, seeking, zooming, paging, and closing Preview call no projection method;
- Present calls readiness once and navigates to `/media` only when requested media is ready.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx src/renderer/src/components/Control/FileExplorer/Preview/__tests__/FilePreviewInspector.test.tsx src/renderer/src/__tests__/router.test.tsx
```

- [ ] **Step 3: Convert Files to a parent route without remounting**

Render `<Outlet />` inside `FilesPage` after the file explorer shell. Define:

```ts
{
  path: 'files',
  element: <FilesPage />,
  children: [{ path: 'preview/:itemId', element: <FilePreviewRoute /> }]
}
```

Use a modal/drawer route element so the parent component and local browse state stay mounted.

- [ ] **Step 4: Implement preview-local state**

Reuse pure preview renderers only when they do not read the live Media store or
`PresenterCommandContext`. Otherwise introduce small preview-only image, video, and PDF adapters
inside the inspector. No preview effect may call projection APIs.

- [ ] **Step 5: Implement explicit Present**

Resolve the current folder's presentable files, preserve ordering, and prioritize the previewed
item. On a successful readiness result, navigate to `/media`. On unavailable requested item, keep
the inspector open and display readiness reason.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
npx vitest run src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx src/renderer/src/components/Control/FileExplorer/Preview/__tests__/FilePreviewInspector.test.tsx src/renderer/src/__tests__/router.test.tsx
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/Control/FileExplorer/Preview/FilePreviewInspector.tsx src/renderer/src/components/Control/FileExplorer/Preview/__tests__/FilePreviewInspector.test.tsx src/renderer/src/pages/FilesPage.tsx src/renderer/src/components/Control/FileExplorer/FileBrowser.tsx src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx src/renderer/src/router.tsx src/renderer/src/__tests__/router.test.tsx
git commit -m "feat: add safe media preview routing"
```

---

### Task 6: Add the Global Now Projecting Bar

**Files:**

- Create: `src/renderer/src/components/Control/NowProjectingBar.tsx`
- Create: `src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx`
- Create: `src/renderer/src/lib/projection-session-summary.ts`
- Create: `src/renderer/src/lib/__tests__/projection-session-summary.test.ts`
- Modify: `src/renderer/src/components/Control/Layout.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`

**Interfaces:**

```ts
export type NowProjectingStatus =
  | 'closed'
  | 'opening'
  | 'connected'
  | 'projecting'
  | 'degraded'
  | 'failed'

export function deriveNowProjectingStatus(input: {
  recovery: ProjectionRecoveryState
  isProjectionOpen: boolean
  hasSnapshot: boolean
  isBlackout: boolean
  skippedMediaCount: number
}): NowProjectingStatus
```

- [ ] **Step 1: Write failing pure status tests**

Use table-driven cases for the exact precedence in the R4 spec.

- [ ] **Step 2: Write failing component action tests**

Cover:

- hidden only when closed;
- localized owner/content label;
- Return to Media Workspace for Media session;
- Stop Content, Resume Content, Close Projection, and Retry call only their intended APIs;
- no action calls foreground.

- [ ] **Step 3: Run tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-summary.test.ts src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx
```

- [ ] **Step 4: Implement pure derivation and HeroUI bar**

Use HeroUI `Card` or `Alert` compound APIs, `ButtonGroup`, semantic status color, `role="status"`,
and `aria-live="polite"`. Place the bar above page content but below
`ProjectionRecoveryNotice`'s z-index.

- [ ] **Step 5: Add localized copy and i18n coverage**

Add owner, statuses, actions, and accessible labels in all three locale files. Run:

```bash
npx vitest run src/renderer/src/i18n/__tests__/i18n.test.ts src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Control/NowProjectingBar.tsx src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx src/renderer/src/lib/projection-session-summary.ts src/renderer/src/lib/__tests__/projection-session-summary.test.ts src/renderer/src/components/Control/Layout.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
git commit -m "feat: add now projecting controls"
```

---

### Task 7: Wire Explicit Stop, Resume, and Close Lifecycle

**Files:**

- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/PresenterHeader.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/MediaPresenter.tsx`
- Modify: `src/renderer/src/components/Control/NowProjectingBar.tsx`
- Modify: `src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx`
- Modify: `src/renderer/src/stores/media-projection.ts`
- Modify: `src/renderer/src/stores/__tests__/media-projection.test.ts`
- Modify: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`

**Interfaces:**

Add one orchestration helper:

```ts
export async function closeProjectionAndMediaSession(input: {
  closeProjection: () => Promise<void>
  endLiveSession: () => void
}): Promise<void>
```

- [ ] **Step 1: Write failing exact-once lifecycle tests**

Cover user close, external projection close, failed close, blackout, resume, and replacement by
Timer/Bible. Confirm resources remain locked through blackout and release only on close/end.

- [ ] **Step 2: Run tests and verify RED**

```bash
npx vitest run src/renderer/src/stores/__tests__/media-projection.test.ts src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx
```

- [ ] **Step 3: Implement explicit command ownership**

- Stop Content calls `blackoutProjection(true)` and preserves Media state.
- Resume calls `blackoutProjection(false)`.
- Close calls `closeProjection()` and then `endLiveSession()` after success.
- Projection lifecycle `closed` calls `markProjectionClosed()` without calling close.
- Timer/Bible ownership replacement preserves Media playlist only until the explicit Media session
  is ended; it does not keep synchronizing Media controls when `activeOwner !== 'media'`.

- [ ] **Step 4: Run focused tests and typecheck**

```bash
npx vitest run src/renderer/src/stores/__tests__/media-projection.test.ts src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/Control/FileExplorer/Presenter/PresenterHeader.tsx src/renderer/src/components/Control/FileExplorer/Presenter/MediaPresenter.tsx src/renderer/src/components/Control/NowProjectingBar.tsx src/renderer/src/components/Control/Bridge/MediaProjectionBridge.tsx src/renderer/src/stores/media-projection.ts src/renderer/src/stores/__tests__/media-projection.test.ts src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
git commit -m "feat: separate media stop and projection close"
```

---

### Task 8: Add R4 Browser and Packaged Electron Acceptance

**Files:**

- Modify: `e2e/browser-projection.spec.ts`
- Modify: `e2e/electron-packaged.spec.ts`
- Modify: `src/renderer/src/components/Control/FileExplorer/Preview/__tests__/FilePreviewInspector.test.tsx`

- [ ] **Step 1: Add browser persistent-output scenario**

Start Media, navigate to Files, open Preview, interact locally, and assert the first projection
payload remains unchanged until Present.

- [ ] **Step 2: Add browser blackout replay scenario**

Black out, reload projection, assert the black surface remains, resume, and assert retained content
returns without an additional popup or focus request.

- [ ] **Step 3: Extend packaged Electron smoke**

Exercise Back to Files, blackout/resume, and Close Projection using stable test IDs. Confirm the
control window stays open throughout.

- [ ] **Step 4: Run browser E2E**

```bash
npm run build
npm run test:e2e:browser
```

- [ ] **Step 5: Run Windows packaged gate**

```bash
npm run build:unpack
set PACKAGED_APP_PATH=dist\win-unpacked\libre-presenter.exe&& npm run test:e2e:packaged
```

On WSL, invoke the packaged commands through `cmd.exe /d /s /c`.

- [ ] **Step 6: Commit**

```bash
git add e2e/browser-projection.spec.ts e2e/electron-packaged.spec.ts src/renderer/src/components/Control/FileExplorer/Preview/__tests__/FilePreviewInspector.test.tsx
git commit -m "test: cover persistent media projection"
```

---

### Task 9: Remove Obsolete Presenter Coupling and Close R4

**Files:**

- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`
- Modify or delete obsolete tests and exports found by the searches below.

- [ ] **Step 1: Search for obsolete coupling**

```bash
rg -n "fixed inset-0 z-9999|isPresentingMedia && <MediaPresenter|return \\(\\) => \\{[^}]*stopProjection|onProjectionOpened|onProjectionClosed" src
rg -n "startMediaProjection" src/renderer/src/components/Control/FileExplorer/FileBrowser.tsx
```

Expected: no fixed overlay, no route-unmount stop, no obsolete lifecycle channels, and
double-click does not call `startMediaProjection`.

- [ ] **Step 2: Run focused R4 suite**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/lib/__tests__/media-projection-sync.test.ts src/renderer/src/stores/__tests__/media-projection.test.ts src/renderer/src/components/Control/Bridge/__tests__/MediaProjectionBridge.test.tsx src/renderer/src/components/Control/FileExplorer/Preview/__tests__/FilePreviewInspector.test.tsx src/renderer/src/pages/__tests__/MediaWorkspacePage.test.tsx src/renderer/src/components/Control/__tests__/NowProjectingBar.test.tsx src/renderer/src/__tests__/router.test.tsx
```

- [ ] **Step 3: Run broad deterministic gates**

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:browser
```

- [ ] **Step 4: Audit R4 acceptance criteria**

Record direct evidence for:

- browse and Preview do not interrupt projection;
- Preview never changes owner;
- Present changes output explicitly and once;
- popup/readiness failure is visible;
- blackout is distinct from fallback;
- Close Projection clears state and resources;
- passive actions never foreground.

- [ ] **Step 5: Update roadmap and commit**

Mark R4 Complete with exact test counts, build budgets, browser E2E, Windows packaged evidence, and
the macOS release-CI limitation.

```bash
git add docs/roadmap/librepresenter-optimization-roadmap.md
git commit -m "docs: complete R4 persistent media workspace"
```
