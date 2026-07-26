# R3 Projection Session Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Timer, Bible, and Media projection sessions generation-safe and replayable across
reload, display move, one bounded Electron renderer crash, and recoverable browser popup failures.

**Architecture:** Electron `WindowManager` owns projection-window generation and crash lifecycle.
A pure control-renderer `ProjectionSessionCoordinator` owns an in-memory final-state snapshot and
replays it atomically when the current generation announces readiness. `ProjectionContext` adapts
Electron IPC or browser popup lifecycle to that coordinator; `ProjectionPage` and
`FileProjection` apply matching-generation replay state.

**Tech Stack:** Electron 39, React 19, TypeScript, Vite/electron-vite, BroadcastChannel, HeroUI v3,
Vitest, Playwright

## Global Constraints

- No new dependency or persistent projection database.
- A generation is a positive safe integer scoped to one application run; zero means no generation.
- Main process owns Electron lifecycle only and never stores Timer, Bible, or Media payloads.
- The renderer snapshot stores final state, never an event log or generic command queue.
- Explicit close clears the session; reload, display move, and crash recovery preserve it.
- One automatic crash recovery is allowed per rolling 30-second window.
- A second crash inside 30 seconds stops automatic recreation and exposes manual Retry.
- Ready timeout is exactly 5 seconds and retains the snapshot for Retry.
- Recovery replay and passive messages never focus, pin, or bring projection forward.
- `DefaultProjection` remains an internal fallback only.
- Browser and Electron must share the same coordinator and snapshot semantics.
- Use HeroUI v3 compound APIs and existing semantic variants for the recovery notice.
- Preserve the projection owner rule and R0 one-shot foreground behavior.

---

### Task 1: Add Shared Generation, Lifecycle, Snapshot, and Transport Contracts

**Files:**

- Modify: `src/shared/projection-messages.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/main/ipc/validate.ts`
- Modify: `src/main/__tests__/ipc/validate.test.ts`

**Interfaces:**

- Produces:

```ts
export type ProjectionLifecycleStatus =
  | 'closed'
  | 'opening'
  | 'ready'
  | 'recovering'
  | 'failed'

export type ProjectionLifecycleReason =
  | 'created'
  | 'reload'
  | 'display-move'
  | 'renderer-crash'
  | 'user-close'
  | 'popup-blocked'
  | 'ready-timeout'

export interface ProjectionLifecycleEvent {
  generation: number
  status: ProjectionLifecycleStatus
  reason: ProjectionLifecycleReason
}

export interface ProjectionFailure {
  generation: number
  reason: 'renderer-crash' | 'popup-blocked' | 'ready-timeout'
}

export interface ProjectionMediaReplayState {
  itemId: string
  positionSeconds: number
  durationSeconds: number
  isPlaying: boolean
  isEnded: boolean
  volume: number
  pdfPage: number
  pdfScroll: number
  pdfViewMode: 'single' | 'continuous'
  zoom: number
  pan: { x: number; y: number }
}

export interface ProjectionSessionSnapshot {
  owner: 'timer' | 'bible' | 'media'
  showDefault: boolean
  timer: {
    tick: AppMessages['timer:tick'] | null
    stopwatch: AppMessages['timer:stopwatch'] | null
    overtimeMessage: AppMessages['timer:overtime-message'] | null
    timezone: AppMessages['settings:timezone'] | null
    ringColor: AppMessages['settings:timer-ring-color'] | null
  }
  bible: {
    chapter: AppMessages['bible:chapter'] | null
    settings: AppMessages['bible:settings'] | null
  }
  media: {
    show: AppMessages['file:show'] | null
    state: ProjectionMediaReplayState | null
  }
}

export type ProjectionOperationResult =
  | { ok: true; generation: number }
  | {
      ok: false
      generation: number
      reason: ProjectionFailure['reason']
    }

export type ProjectionTransportTuple = {
  [C in ProjectionChannel]: [
    generation: number,
    channel: C,
    data: ProjectionPayload<C>
  ]
}[ProjectionChannel]

export type ProjectionContentChannel = Exclude<
  ProjectionChannel,
  `__system:${string}` | 'file:playback-state'
>

export type ProjectionContentMessageTuple = {
  [C in ProjectionContentChannel]: [
    channel: C,
    data: ProjectionPayload<C>
  ]
}[ProjectionContentChannel]
```

Add:

```ts
export interface SystemMessages {
  '__system:ready': { generation: number }
  '__system:replay': {
    generation: number
    snapshot: ProjectionSessionSnapshot
  }
  // Existing system messages remain, with their current payloads.
}
```

Task 1 keeps the existing transport maps source-compatible so its commit remains typecheck-green.
It adds only the lifecycle event channel:

```ts
'projection:lifecycle': [event: ProjectionLifecycleEvent]
```

Task 4 switches `IpcSendMap['projection:send']`,
`IpcSendMap['projection:send-to-main']`, and
`IpcMainToRendererMap['projection:message']` to `ProjectionTransportTuple` in the same commit that
updates all transport call sites.

- [ ] **Step 1: Write RED transport-validation tests**

Add cases to `src/main/__tests__/ipc/validate.test.ts`:

```ts
it('accepts a positive generation with matching ready payload', () => {
  expect(
    validateProjectionTransportTuple([4, '__system:ready', { generation: 4 }])
  ).toBe(true)
})

it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid generation %s',
  (generation) => {
    expect(
      validateProjectionTransportTuple([
        generation,
        'timer:overtime-message',
        { message: 'test' }
      ])
    ).toBe(false)
  }
)

it('rejects a ready payload for another generation', () => {
  expect(
    validateProjectionTransportTuple([4, '__system:ready', { generation: 3 }])
  ).toBe(false)
})

it('accepts a minimally valid replay snapshot', () => {
  expect(
    validateProjectionTransportTuple([
      4,
      '__system:replay',
      {
        generation: 4,
        snapshot: {
          owner: 'timer',
          showDefault: false,
          timer: {
            tick: null,
            stopwatch: null,
            overtimeMessage: null,
            timezone: null,
            ringColor: null
          },
          bible: { chapter: null, settings: null },
          media: { show: null, state: null }
        }
      }
    ])
  ).toBe(true)
})
```

- [ ] **Step 2: Run validation tests and verify RED**

```bash
npx vitest run src/main/__tests__/ipc/validate.test.ts
```

Expected: import/type failures because `validateProjectionTransportTuple` and shared contracts do
not exist.

- [ ] **Step 3: Implement shared contracts and strict transport validation**

Reorder `projection-messages.ts` so `AppMessages` is declared before snapshot types, then declare
`SystemMessages` and `ProjectionMessageMap`. Avoid recursive use of `ProjectionPayload` inside the
snapshot definition.

In `validate.ts`, add the generated validator beside the existing two-argument validator:

```ts
export function isValidProjectionGeneration(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

export function validateProjectionTransportTuple(
  args: unknown[]
): args is ProjectionTransportTuple {
  if (args.length !== 3 || !isValidProjectionGeneration(args[0])) return false
  const [generation, channel, data] = args
  if (typeof channel !== 'string') return false
  if (channel === '__system:ready') {
    return (
      typeof data === 'object' &&
      data !== null &&
      (data as { generation?: unknown }).generation === generation
    )
  }
  if (channel === '__system:replay') {
    return validateProjectionReplayPayload(generation, data)
  }
  return validateProjectionPayload(channel, data)
}
```

`validateProjectionReplayPayload()` must verify matching generation, owner, `showDefault`, the
three nested domain objects, and every non-null numeric/boolean field in Media replay state.
Extract the existing per-channel payload switch as private `validateProjectionPayload()` and keep
`validateProjectionMessageTuple()` as a compatibility wrapper until Task 4 removes its last use.

- [ ] **Step 4: Run Task 1 tests and typecheck**

```bash
npx vitest run src/main/__tests__/ipc/validate.test.ts
npm run typecheck
```

Expected: validation tests pass. Typecheck may identify transport call sites intentionally updated
in Task 4, but Task 1 itself must remain typecheck-green because IPC transport maps have not
changed yet.

- [ ] **Step 5: Commit**

```bash
git add src/shared/projection-messages.ts src/shared/ipc-channels.ts src/main/ipc/validate.ts src/main/__tests__/ipc/validate.test.ts
git commit -m "feat: define projection recovery contracts"
```

---

### Task 2: Implement the Pure Projection Session Coordinator

**Files:**

- Create: `src/renderer/src/lib/projection-session-coordinator.ts`
- Create: `src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts`

**Interfaces:**

- Consumes: shared types from Task 1.
- Produces:

```ts
export type ReplayableProjectionChannel = Exclude<
  ProjectionChannel,
  `__system:${string}` | 'file:playback-state' | 'file:end'
>

export interface ProjectionRecoveryState {
  status: ProjectionLifecycleStatus
  generation: number
  failure: ProjectionFailure | null
}

export type ProjectionCoordinatorSend = <C extends ProjectionChannel>(
  channel: C,
  data: ProjectionPayload<C>
) => void

export interface ProjectionSessionCoordinator {
  startSession(owner: ProjectionOwner, payloads: ProjectionContentMessageTuple[]): void
  claim(owner: ProjectionOwner, unblank?: boolean): void
  blank(showDefault: boolean): void
  project<C extends ReplayableProjectionChannel>(
    channel: C,
    data: ProjectionPayload<C>
  ): void
  sendOneShot<C extends 'file:end'>(channel: C, data: ProjectionPayload<C>): void
  recordPlayback(generation: number, data: ProjectionPayload<'file:playback-state'>): void
  beginGeneration(event: ProjectionLifecycleEvent): void
  ready(generation: number): void
  fail(generation: number, reason: ProjectionFailure['reason']): void
  waitForReady(generation: number): Promise<ProjectionOperationResult>
  endSession(): void
  getSnapshot(): ProjectionSessionSnapshot | null
  getRecoveryState(): ProjectionRecoveryState
  subscribe(listener: () => void): () => void
  dispose(): void
}

export function createProjectionSessionCoordinator(
  send: ProjectionCoordinatorSend,
  readyTimeoutMs = 5000
): ProjectionSessionCoordinator
```

Use exact Media defaults:

```ts
const DEFAULT_MEDIA_REPLAY_STATE = {
  positionSeconds: 0,
  durationSeconds: 0,
  isPlaying: false,
  isEnded: false,
  volume: 1,
  pdfPage: 1,
  pdfScroll: 0,
  pdfViewMode: 'single' as const,
  zoom: 1,
  pan: { x: 0, y: 0 }
}
```

- [ ] **Step 1: Write RED snapshot-reducer tests**

Cover Timer/Bible replacement and Media command reduction:

```ts
it('reduces repeated media controls to one final replay state', () => {
  coordinator.startSession('media', [['file:show', fileShow]])
  coordinator.project('file:control', { action: 'seek', itemId: 'video-1', value: 8 })
  coordinator.project('file:control', { action: 'seek', itemId: 'video-1', value: 12 })
  coordinator.project('file:control', { action: 'volume', itemId: 'video-1', value: 0.4 })
  coordinator.project('file:control', { action: 'play', itemId: 'video-1' })

  expect(coordinator.getSnapshot()?.media.state).toMatchObject({
    itemId: 'video-1',
    positionSeconds: 12,
    volume: 0.4,
    isPlaying: true
  })
})

it('ignores playback reports for the wrong item or generation', () => {
  coordinator.startSession('media', [['file:show', fileShow]])
  coordinator.beginGeneration({ generation: 3, status: 'opening', reason: 'created' })
  coordinator.recordPlayback(2, playback)
  coordinator.recordPlayback(3, { ...playback, itemId: 'other' })
  expect(coordinator.getSnapshot()?.media.state?.positionSeconds).toBe(0)
})
```

Also cover PDF page/scroll/view mode, zoom/pan, new `file:show` resetting item state, `file:end`
not entering snapshot, and explicit close clearing the snapshot.

- [ ] **Step 2: Write RED lifecycle and async-readiness tests**

Use fake timers and cover:

```ts
it('replays once for matching ready and ignores an old ready', () => {
  coordinator.startSession('timer', [['timer:tick', timerTick]])
  coordinator.beginGeneration({ generation: 7, status: 'opening', reason: 'reload' })

  coordinator.ready(6)
  expect(send).not.toHaveBeenCalled()

  coordinator.ready(7)
  expect(send).toHaveBeenCalledOnce()
  expect(send).toHaveBeenCalledWith('__system:replay', {
    generation: 7,
    snapshot: coordinator.getSnapshot()
  })
})

it('times out only the captured generation and retains the snapshot', async () => {
  coordinator.startSession('bible', [['bible:chapter', chapter]])
  coordinator.beginGeneration({ generation: 2, status: 'opening', reason: 'created' })
  const resultPromise = coordinator.waitForReady(2)

  await vi.advanceTimersByTimeAsync(5000)

  await expect(resultPromise).resolves.toEqual({
    ok: false,
    generation: 2,
    reason: 'ready-timeout'
  })
  expect(coordinator.getSnapshot()?.bible.chapter).toEqual(chapter)
})
```

Also test recovery/failed states, retry with a newer generation, subscriber notifications, and
disposal. When a reload/display replacement changes generation while one caller is awaiting ready,
retarget that same pending operation to the new generation: the old timeout becomes inert and the
new matching ready resolves the operation with the replacement generation.

- [ ] **Step 3: Run coordinator tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts
```

Expected: module import failure.

- [ ] **Step 4: Implement immutable snapshot reduction and generation state machine**

Use private helpers:

```ts
function createEmptySnapshot(owner: ProjectionOwner): ProjectionSessionSnapshot
function reduceReplayableMessage<C extends ReplayableProjectionChannel>(
  snapshot: ProjectionSessionSnapshot,
  channel: C,
  data: ProjectionPayload<C>
): ProjectionSessionSnapshot
function reducePlaybackState(
  snapshot: ProjectionSessionSnapshot,
  data: ProjectionPayload<'file:playback-state'>
): ProjectionSessionSnapshot
```

Keep one current operation waiter and one timeout. `beginGeneration()` retargets an unresolved
waiter to the replacement generation and replaces its timeout; callbacks captured by older
generations become no-ops. `ready()` sends exactly one replay for the current generation, resolves
the waiter with that generation, and changes state to `ready`. `project()` reduces first and sends
incrementally only while current status is `ready`. `sendOneShot()` sends only while ready and
never writes snapshot.

- [ ] **Step 5: Run coordinator tests and verify GREEN**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/projection-session-coordinator.ts src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts
git commit -m "feat: add projection session coordinator"
```

---

### Task 3: Make `WindowManager` Generation-Aware and Crash-Recoverable

**Files:**

- Modify: `src/main/windowManager.ts`
- Modify: `src/main/__tests__/windowManager.test.ts`

**Interfaces:**

- Consumes: lifecycle types from Task 1.
- Produces:

```ts
export interface ProjectionWindowState {
  exists: boolean
  lifecycle: ProjectionLifecycleEvent
}

createProjectionWindow(
  displayId?: string,
  reason?: 'created' | 'display-move' | 'renderer-crash'
): number
getProjectionState(): ProjectionWindowState
markProjectionReady(generation: number): boolean
moveProjectionWindow(displayId: string): { moved: boolean; generation: number }
retryProjectionWindow(): { retried: boolean; generation: number }
isCurrentProjectionSender(sender: Electron.WebContents, generation: number): boolean
closeProjection(): void
```

- [ ] **Step 1: Extend `FakeBrowserWindow` and write RED generation tests**

Make its `webContents` event handlers triggerable:

```ts
webContents = {
  setWindowOpenHandler: vi.fn(),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = this.webContentsHandlers.get(event) ?? []
    handlers.push(handler)
    this.webContentsHandlers.set(event, handlers)
  }),
  send: vi.fn(),
  isDestroyed: vi.fn(() => false)
}

emitWebContents(event: string, ...args: unknown[]): void {
  for (const handler of this.webContentsHandlers.get(event) ?? []) handler(...args)
}
```

Add:

```ts
it('allocates once for initial load and once for a later reload', () => {
  const first = wm.createProjectionWindow()
  const projection = FakeBrowserWindow.instances[0]
  projection.emitWebContents('did-finish-load')
  projection.emitWebContents('did-start-loading')

  expect(first).toBe(1)
  expect(wm.getProjectionState().lifecycle).toMatchObject({
    generation: 2,
    status: 'opening',
    reason: 'reload'
  })
})

it('moves to another display with a new generation without reporting user close', () => {
  wm.createProjectionWindow()
  const result = wm.moveProjectionWindow('2')
  expect(result).toEqual({ moved: true, generation: 2 })
  expect(wm.getProjectionState().lifecycle.reason).toBe('display-move')
})
```

- [ ] **Step 2: Write RED crash-budget tests with fake time**

```ts
it('recovers one renderer crash and fails the second inside 30 seconds', () => {
  vi.setSystemTime(1_000)
  wm.createProjectionWindow('2')
  FakeBrowserWindow.instances[0].emitWebContents('render-process-gone', {}, { reason: 'crashed' })

  expect(FakeBrowserWindow.instances).toHaveLength(2)
  expect(wm.getProjectionState().lifecycle.status).toBe('recovering')

  vi.setSystemTime(20_000)
  FakeBrowserWindow.instances[1].emitWebContents('render-process-gone', {}, { reason: 'crashed' })

  expect(FakeBrowserWindow.instances).toHaveLength(2)
  expect(wm.getProjectionState().lifecycle).toMatchObject({
    status: 'failed',
    reason: 'renderer-crash'
  })
})
```

Also verify a crash after 30 seconds recovers, manual Retry resets budget, normal `closed` never
recreates, same display is retained, and no focus/`alwaysOnTop`/extra `moveTop` occurs.

- [ ] **Step 3: Run WindowManager tests and verify RED**

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

- [ ] **Step 4: Implement the lifecycle state machine**

Add private state:

```ts
private projectionGeneration = 0
private projectionLifecycle: ProjectionLifecycleEvent = {
  generation: 0,
  status: 'closed',
  reason: 'user-close'
}
private projectionDisplayId = ''
private replacementReason: 'display-move' | 'renderer-crash' | null = null
private lastAutomaticRecoveryAt: number | null = null
```

Use:

```ts
private nextProjectionGeneration(
  status: 'opening' | 'recovering',
  reason: ProjectionLifecycleReason
): number {
  this.projectionGeneration += 1
  this.publishProjectionLifecycle({
    generation: this.projectionGeneration,
    status,
    reason
  })
  return this.projectionGeneration
}
```

Capture `projectionWindow` and its assigned generation inside every handler. Identity and
generation checks must precede state changes. Treat `reason === 'clean-exit'` as normal only when
the window is already closing; all abnormal `render-process-gone` reasons use the crash budget.

- [ ] **Step 5: Run WindowManager tests and verify GREEN**

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/main/windowManager.ts src/main/__tests__/windowManager.test.ts
git commit -m "feat: recover projection window generations"
```

---

### Task 4: Route Generation Through IPC, Preload, and Both Adapters

**Files:**

- Modify: `src/main/ipc/projection.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/lib/projection-adapter.ts`
- Modify: `src/main/__tests__/ipc/projection.test.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`
- Modify: `src/renderer/src/lib/__tests__/projection-adapter.test.ts`

**Interfaces:**

```ts
interface ProjectionAPI {
  check(): Promise<ProjectionWindowState>
  ensure(displayId?: string): Promise<{ created: boolean; generation: number }>
  moveToDisplay(displayId: string): Promise<{ moved: boolean; generation: number }>
  retry(): Promise<{ retried: boolean; generation: number }>
  getGeneration(): Promise<{ generation: number }>
  send<C extends ProjectionChannel>(
    generation: number,
    channel: C,
    data: ProjectionPayload<C>
  ): void
  sendToMain<C extends ProjectionChannel>(
    generation: number,
    channel: C,
    data: ProjectionPayload<C>
  ): void
  onProjectionMessage(
    callback: (
      generation: number,
      channel: ProjectionChannel,
      data: ProjectionPayload<ProjectionChannel>
    ) => void
  ): () => void
  onProjectionLifecycle(callback: (event: ProjectionLifecycleEvent) => void): () => void
}

interface ProjectionAdapter {
  setGeneration(generation: number): void
  getGeneration(): number
  send<C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>): void
  on<C extends ProjectionChannel>(
    channel: C,
    handler: (data: ProjectionPayload<C>) => void
  ): () => void
  dispose(): void
}
```

- [ ] **Step 1: Write RED IPC authorization and generation tests**

Add to `projection.test.ts`:

```ts
it('forwards a matching-generation control message', () => {
  mockWindowManager.isCurrentProjectionSender.mockReturnValue(true)
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
  getOnHandler('projection:send')(
    makeEvent(),
    4,
    'timer:overtime-message',
    { message: 'safe' }
  )
  expect(mockWindowManager.sendToProjection).toHaveBeenCalledWith(
    'projection:message',
    4,
    'timer:overtime-message',
    { message: 'safe' }
  )
})

it('rejects ready from a stale or non-projection sender', () => {
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
  mockWindowManager.isCurrentProjectionSender.mockReturnValue(false)
  getOnHandler('projection:send-to-main')(
    makeEvent(),
    3,
    '__system:ready',
    { generation: 3 }
  )
  expect(mockWindowManager.markProjectionReady).not.toHaveBeenCalled()
  expect(mockWindowManager.sendToMain).not.toHaveBeenCalled()
})
```

Also cover `check`, `ensure`, `move-to-display`, `retry`, `get-generation`, lifecycle subscription,
and unknown/main/projection sender boundaries.

- [ ] **Step 2: Write RED adapter generation tests**

Update browser messages to include generation and assert filtering:

```ts
const adapter = createProjectionAdapter('main')
adapter.setGeneration(5)
adapter.send('timer:overtime-message', payload)
expect(mockPostMessage).toHaveBeenCalledWith(
  expect.objectContaining({ generation: 5, channel: 'timer:overtime-message', data: payload })
)

listener({
  data: {
    generation: 4,
    channel: 'timer:overtime-message',
    data: payload,
    sender: 'other'
  }
} as MessageEvent)
expect(handler).not.toHaveBeenCalled()
```

For Electron, assert `api.send(5, channel, data)` and incoming generation filtering.

- [ ] **Step 3: Run IPC and adapter tests and verify RED**

```bash
npx vitest run src/main/__tests__/ipc/projection.test.ts src/main/__tests__/ipc/projection-vlc.test.ts src/renderer/src/lib/__tests__/projection-adapter.test.ts
```

- [ ] **Step 4: Implement IPC/preload transport and lifecycle APIs**

In `projection.ts`:

```ts
ipcMain.on('projection:send', (event, ...args: unknown[]) => {
  if (!isMainWindow(windowManager, event)) return
  if (!validateProjectionTransportTuple(args)) return
  const [generation, channel, data] = args
  if (windowManager.getProjectionState().lifecycle.generation !== generation) return
  windowManager.sendToProjection('projection:message', generation, channel, data)
})

ipcMain.on('projection:send-to-main', (event, ...args: unknown[]) => {
  if (!validateProjectionTransportTuple(args)) return
  const [generation, channel, data] = args
  if (!windowManager.isCurrentProjectionSender(event.sender, generation)) return
  if (channel === '__system:ready') windowManager.markProjectionReady(generation)
  windowManager.sendToMain('projection:message', generation, channel, data)
})
```

`projection:get-generation` returns zero unless the sender is the exact current projection window.
`projection:retry` is main-window only.

Update VLC `sendState()` to include `wm.getProjectionState().lifecycle.generation` when sending
`projection:message`; do not allow VLC reports without a current positive generation.

- [ ] **Step 5: Implement adapter generation filtering**

Both adapters start with generation zero. `send()` is a no-op until `setGeneration()` receives a
positive safe integer. Incoming messages are dispatched only when envelope generation equals
`getGeneration()`. Keep sender-ID self-filtering in browser mode.

- [ ] **Step 6: Run Task 4 tests and typecheck**

```bash
npx vitest run src/main/__tests__/ipc/projection.test.ts src/main/__tests__/ipc/projection-vlc.test.ts src/renderer/src/lib/__tests__/projection-adapter.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc/projection.ts src/main/ipc/projection-vlc.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/lib/projection-adapter.ts src/main/__tests__/ipc/projection.test.ts src/main/__tests__/ipc/projection-vlc.test.ts src/renderer/src/lib/__tests__/projection-adapter.test.ts
git commit -m "feat: enforce projection transport generations"
```

---

### Task 5: Integrate Recovery Lifecycle into `ProjectionContext`

**Files:**

- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`
- Modify: `src/renderer/src/components/Control/Header/__tests__/Header.test.tsx`

**Interfaces:**

`ProjectionContextValue` adds:

```ts
recovery: ProjectionRecoveryState
retryProjection(): Promise<ProjectionOperationResult>
openProjection(): Promise<ProjectionOperationResult>
startProjection(
  owner: ProjectionOwner,
  payloads?: ProjectionContentMessageTuple[],
  options?: StartProjectionOptions
): Promise<ProjectionOperationResult>
```

Existing `project()` continues returning `Promise<void>` so passive bridges do not need operation
result handling. `ProjectionContext` re-exports
`ProjectionContentMessageTuple as ContentMessageTuple` so current consumers remain source
compatible.

- [ ] **Step 1: Rewrite context tests around coordinator behavior**

Replace assertions against the old pending map with externally visible behavior:

```ts
it('does not treat an existing Electron window as ready until matching ready arrives', async () => {
  mockCheck.mockResolvedValue({
    exists: true,
    lifecycle: { generation: 4, status: 'opening', reason: 'reload' }
  })
  const { result } = renderProjection()
  await act(async () => Promise.resolve())

  expect(result.current.isProjectionOpen).toBe(true)
  expect(result.current.recovery.status).toBe('opening')
  await act(async () => {
    await result.current.project('timer:overtime-message', { message: 'buffered' })
  })
  expect(mockAdapter.send).not.toHaveBeenCalledWith(
    'timer:overtime-message',
    expect.anything()
  )
})

it('returns popup-blocked and keeps a retryable failed state', async () => {
  mockWindowOpen.mockReturnValue(null)
  const { result } = renderProjection()
  let operation: ProjectionOperationResult | undefined
  await act(async () => {
    operation = await result.current.startProjection('timer', [
      ['timer:tick', timerTick]
    ])
  })
  expect(operation).toMatchObject({ ok: false, reason: 'popup-blocked' })
  expect(result.current.recovery).toMatchObject({
    status: 'failed',
    failure: { reason: 'popup-blocked' }
  })
})
```

Also cover matching ready success, stale ready ignored, timeout, lifecycle `recovering` and
`failed`, Retry allocation, explicit close clearing snapshot, popup polling close, browser reload
not emitting closed, and no browser focus calls.

- [ ] **Step 2: Run context tests and verify RED**

```bash
npx vitest run src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx
```

- [ ] **Step 3: Replace pending refs with one coordinator**

Create coordinator once in a stable ref after adapter construction:

```ts
const coordinatorRef = useRef<ProjectionSessionCoordinator | null>(null)

function getCoordinator(): ProjectionSessionCoordinator {
  if (!coordinatorRef.current) {
    coordinatorRef.current = createProjectionSessionCoordinator((channel, data) => {
      getAdapter(adapterRef).send(channel, data)
    })
  }
  return coordinatorRef.current
}
```

Subscribe with `useSyncExternalStore` or a single effect-backed state update; do not mirror
snapshot contents in React state. Remove `pendingPayloadsRef`, `pendingSequenceRef`,
`readyResolveRef`, and `autoOpenTimeoutRef`.

Electron flow:

```ts
window.api.projection.check().then(({ exists, lifecycle }) => {
  setIsProjectionOpen(exists)
  if (lifecycle.generation > 0) {
    adapter.setGeneration(lifecycle.generation)
    coordinator.beginGeneration(lifecycle)
  }
})
```

On lifecycle generation changes, update adapter before coordinator. On `__system:ready`, call
`coordinator.ready(data.generation)`. On `file:playback-state`, record it before notifying context
subscribers such as `MediaPresenter`.

The public `send()` function must route replayable Timer/Bible/Media/settings messages through
`coordinator.project()` so timezone and ring-color updates enter the snapshot. `project('file:end',
null)` routes through `coordinator.sendOneShot()` and is dropped while no generation is ready.
System messages remain private lifecycle operations rather than raw consumer bypasses.

Browser `getProjectionUrl(generation)` returns:

```ts
`${location.origin}${location.pathname}#/projection?generation=${generation}`
```

Allocate browser generations monotonically in the control window. A `null` popup calls
`coordinator.fail(generation, 'popup-blocked')` immediately.

- [ ] **Step 4: Preserve explicit foreground and close semantics**

`startProjection()` calls `coordinator.startSession()` before opening. It waits for matching ready
and applies `bringProjectionToFront()` only through the existing explicit path. `project()` records
or sends without foreground unless its existing option is true. `closeProjection()` calls
`coordinator.endSession()` before closing; display lifecycle and recovery never do.

- [ ] **Step 5: Update typed mocks and run renderer context gates**

Use this default in context mocks:

```ts
recovery: {
  status: 'closed',
  generation: 0,
  failure: null
},
retryProjection: vi.fn().mockResolvedValue({ ok: true, generation: 1 })
```

Run:

```bash
npx vitest run src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/components/Control/Bridge/__tests__/TimerProjectionBridge.test.tsx src/renderer/src/pages/__tests__/TimerPage.test.tsx
npm run typecheck:web
```

- [ ] **Step 6: Commit**

```bash
git diff --name-only
git add src/renderer/src/contexts/ProjectionContext.tsx src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/components/Control/Header/__tests__/Header.test.tsx
git diff --cached --name-only
git commit -m "feat: coordinate projection session recovery"
```

If typecheck identifies another structurally typed context mock, add that exact file to both the
plan's file list and the commit only after confirming the error is caused by Task 5. Exclude
formatting-only files.

---

### Task 6: Apply Atomic Replay in the Projection Renderer

**Files:**

- Create: `src/renderer/src/lib/projection-render-state.ts`
- Create: `src/renderer/src/lib/__tests__/projection-render-state.test.ts`
- Modify: `src/renderer/src/pages/ProjectionPage.tsx`
- Modify: `src/renderer/src/pages/__tests__/ProjectionPage.test.tsx`

**Interfaces:**

```ts
export interface ProjectionRenderState {
  showDefault: boolean
  activeContent: 'timer' | 'bible' | 'file' | null
  timerData: ProjectionPayload<'timer:tick'> | null
  stopwatchData: ProjectionPayload<'timer:stopwatch'> | null
  bibleChapter: ProjectionPayload<'bible:chapter'> | null
  bibleSettings: ProjectionPayload<'bible:settings'>
  fileData: ProjectionPayload<'file:show'> | null
  mediaReplayState: ProjectionMediaReplayState | null
  fileControlEvent: { id: number; data: FileControlPayload } | null
  timerRingColor: string | null
  generation: number
}

export type ProjectionRenderAction =
  | { type: 'replay'; payload: ProjectionPayload<'__system:replay'> }
  | {
      type: 'message'
      channel: ProjectionChannel
      data: ProjectionPayload<ProjectionChannel>
    }
```

- [ ] **Step 1: Write RED pure render-state tests**

```ts
it('applies a media replay in one reducer action', () => {
  const next = reduceProjectionRenderState(initialState, {
    type: 'replay',
    payload: { generation: 3, snapshot: mediaSnapshot }
  })
  expect(next).toMatchObject({
    generation: 3,
    showDefault: false,
    activeContent: 'file',
    fileData: mediaSnapshot.media.show,
    mediaReplayState: mediaSnapshot.media.state
  })
})

it('does not make a system owner without matching content visible', () => {
  const next = reduceProjectionRenderState(initialState, {
    type: 'replay',
    payload: { generation: 3, snapshot: emptyBibleSnapshot }
  })
  expect(next.activeContent).toBe('bible')
  expect(next.showDefault).toBe(false)
  expect(selectVisibleProjection(next)).toBe('default')
})
```

Cover Timer, Bible, Media, blank internal fallback, and incremental messages after replay.

- [ ] **Step 2: Run render-state tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-render-state.test.ts
```

- [ ] **Step 3: Implement one reducer and one projection-page subscription effect**

`ProjectionPage` resolves generation before sending ready:

```ts
async function resolveProjectionGeneration(): Promise<number> {
  if (isElectron()) {
    return (await window.api.projection.getGeneration()).generation
  }
  const query = location.hash.split('?')[1] ?? ''
  const generation = Number(new URLSearchParams(query).get('generation'))
  return Number.isSafeInteger(generation) && generation > 0 ? generation : 0
}
```

If generation is zero, render internal fallback and never send ready. Otherwise set adapter
generation, subscribe to all relevant channels including `__system:replay`, then send:

```ts
adapter.send('__system:ready', { generation })
```

Remove projection-page `beforeunload` closed signaling. Browser control-window popup polling is the
only close authority.

- [ ] **Step 4: Pass generation and replay state to `FileProjection`**

```tsx
<FileProjection
  generation={state.generation}
  initialReplayState={state.mediaReplayState}
  // existing file props
/>
```

This compiles after Task 7 completes; keep the RED type error explicit until then.

- [ ] **Step 5: Run projection-page tests**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx
```

- [ ] **Step 6: Commit**

Commit Task 6 together with Task 7 after `FileProjection` accepts the new props; do not create an
intentionally type-broken intermediate commit.

---

### Task 7: Restore Native Video, VLC, PDF, Image, and Slide State

**Files:**

- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Modify: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`

**Interfaces:**

`FileProjectionProps` gains:

```ts
generation: number
initialReplayState?: ProjectionMediaReplayState | null
```

`ProjectionVlcStartRequest` gains:

```ts
initialPositionSeconds?: number
initialVolume?: number
initialPlaybackState?: 'playing' | 'paused' | 'ended'
```

- [ ] **Step 1: Write RED native-video replay tests**

```ts
it('applies replay seek and volume before resuming a playing video', async () => {
  render(
    <FileProjection
      generation={4}
      initialItemId="video-1"
      initialBlobId="blob-1"
      initialMimeType="video/mp4"
      initialReplayState={{
        ...defaultReplay,
        itemId: 'video-1',
        positionSeconds: 18,
        volume: 0.35,
        isPlaying: true
      }}
    />
  )
  const video = await screen.findByTestId('projection-video')
  Object.defineProperty(video, 'readyState', { configurable: true, value: 1 })
  Object.defineProperty(video, 'duration', { configurable: true, value: 100 })
  fireEvent.loadedMetadata(video)

  expect(video.currentTime).toBe(18)
  expect(video.volume).toBe(0.35)
  expect(video.play).toHaveBeenCalled()
})
```

Add paused, ended, wrong-item, initial zoom/pan, PDF page/view/scroll, and adapter generation
assertions.

- [ ] **Step 2: Write RED VLC replay tests**

Assert `projectionVlc.start()` receives initial state and main applies it after source selection:

```ts
expect(mockStart).toHaveBeenCalledWith(
  expect.objectContaining({
    initialPositionSeconds: 18,
    initialVolume: 0.35,
    initialPlaybackState: 'playing'
  })
)
```

In main tests, assert call order `setSource` → `setVolume` → `setTime` → `play`, while paused omits
`play` and ended remains stopped.

- [ ] **Step 3: Run FileProjection and VLC tests and verify RED**

```bash
npx vitest run src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/main/__tests__/ipc/projection-vlc.test.ts
```

- [ ] **Step 4: Apply replay state during source initialization**

On item load, initialize:

```ts
setZoom(replay?.zoom ?? 1)
setPan(replay?.pan ?? { x: 0, y: 0 })
pendingVideoControlRef.current =
  replay && replay.itemId === itemId
    ? {
        itemId,
        seekTo: replay.positionSeconds,
        shouldPlay: replay.isPlaying && !replay.isEnded,
        volume: replay.volume
      }
    : null
```

Initialize PDF `currentPage` and `viewMode` from replay. After continuous PDF children render, set
scroll using the same existing page-float calculation. Set `isEnded` from replay only for the
matching item.

Set the projection-role adapter generation before subscribing or sending playback state:

```ts
const adapter = createProjectionAdapter('projection')
adapter.setGeneration(generation)
```

- [ ] **Step 5: Apply VLC initial state in main**

After `setSource()`:

```ts
if (request.initialVolume !== undefined) {
  nextPlayer.setVolume(Math.round(clamp(request.initialVolume, 0, 1) * 100))
}
if (request.initialPositionSeconds !== undefined) {
  nextPlayer.setTime(Math.max(0, Math.round(request.initialPositionSeconds * 1000)))
}
if (request.initialPlaybackState === 'playing') nextPlayer.play()
```

Do not call play for paused or ended state.

- [ ] **Step 6: Run Task 6-7 focused tests and typecheck**

```bash
npx vitest run src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.editable-payload.test.tsx src/main/__tests__/ipc/projection-vlc.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit Tasks 6 and 7**

```bash
git add src/renderer/src/lib/projection-render-state.ts src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/pages/ProjectionPage.tsx src/renderer/src/pages/__tests__/ProjectionPage.test.tsx src/renderer/src/components/Projection/FileProjection.tsx src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/shared/ipc-channels.ts src/main/ipc/projection-vlc.ts src/main/__tests__/ipc/projection-vlc.test.ts
git commit -m "feat: replay projection render state"
```

---

### Task 8: Add the Global Recovery Notice

**Files:**

- Create: `src/renderer/src/components/Control/ProjectionRecoveryNotice.tsx`
- Create: `src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx`
- Modify: `src/renderer/src/components/Control/Layout.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`

**Interfaces:**

The component reads `recovery` and `retryProjection` from `useProjection()` and renders nothing
for `closed`, `opening`, or `ready`.

- [ ] **Step 1: Write RED accessible notice tests**

```ts
it('shows a polite non-blocking recovery status', () => {
  mockUseProjection.mockReturnValue({
    ...projectionContext,
    recovery: {
      status: 'recovering',
      generation: 3,
      failure: null
    }
  })
  render(<ProjectionRecoveryNotice />)
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it.each(['popup-blocked', 'ready-timeout', 'renderer-crash'] as const)(
  'offers Retry for %s',
  async (reason) => {
    mockUseProjection.mockReturnValue({
      ...projectionContext,
      recovery: {
        status: 'failed',
        generation: 3,
        failure: { generation: 3, reason }
      }
    })
    render(<ProjectionRecoveryNotice />)
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(retryProjection).toHaveBeenCalledOnce()
  }
)
```

- [ ] **Step 2: Run notice tests and verify RED**

```bash
npx vitest run src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx
```

- [ ] **Step 3: Implement HeroUI v3 Alert and localized copy**

Use:

```tsx
<Alert
  status={recovery.status === 'failed' ? 'danger' : 'accent'}
  role="status"
  aria-live="polite"
  className="fixed bottom-4 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2"
>
  <Alert.Indicator />
  <Alert.Content>
    <Alert.Title>{title}</Alert.Title>
    <Alert.Description>{description}</Alert.Description>
  </Alert.Content>
  {recovery.status === 'failed' && (
    <Button size="sm" variant="secondary" onPress={() => void retryProjection()}>
      {t('projection.recovery.retry')}
    </Button>
  )}
</Alert>
```

Add exact keys in all three locale files:

```json
"recovery": {
  "recoveringTitle": "Restoring projection",
  "recoveringDescription": "The output window is restarting with the last projected content.",
  "popupBlockedTitle": "Projection popup was blocked",
  "popupBlockedDescription": "Allow popups for this site, then retry.",
  "readyTimeoutTitle": "Projection did not become ready",
  "readyTimeoutDescription": "Retry opening the output window.",
  "rendererCrashTitle": "Projection stopped unexpectedly",
  "rendererCrashDescription": "Automatic recovery stopped after repeated failures.",
  "retry": "Retry projection"
}
```

Translate naturally for zh-TW and zh-CN. Do not include raw reasons.

- [ ] **Step 4: Mount inside `ProjectionProvider` and run tests**

Place `<ProjectionRecoveryNotice />` near other global bridges in `Layout`, inside
`ProjectionProvider` and outside routed content.

```bash
npx vitest run src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx src/renderer/src/components/Control/__tests__/Layout.test.tsx
npm run typecheck:web
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/Control/ProjectionRecoveryNotice.tsx src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx src/renderer/src/components/Control/Layout.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
git commit -m "feat: surface projection recovery failures"
```

---

### Task 9: Add Browser Reload, Popup Failure, and Packaged Electron Recovery E2E

**Files:**

- Modify: `e2e/browser-projection.spec.ts`
- Modify: `e2e/electron-packaged.spec.ts`
- Modify: `playwright.config.ts` only if popup-blocking context permissions require it

**Interfaces:**

- Browser E2E verifies reload replay without another explicit Start.
- Packaged Electron E2E verifies projection `page.reload()` replay.

- [ ] **Step 1: Add browser reload replay test**

Extend the existing test after Timer is visible:

```ts
const beforeReload = await projection.locator('.timer-digits').first().textContent()
await projection.reload()
await expect(projection.locator('.timer-digits').first()).toBeVisible()
await expect
  .poll(async () => projection.locator('.timer-digits').first().textContent())
  .not.toBeNull()
expect(context.pages()).toHaveLength(2)
expect(await page.evaluate(() => window.__projectionFocusCalls)).toBe(0)
expect(beforeReload).not.toBeNull()
```

The timer value may advance; assert visible Timer content and no extra popup/focus, not exact text.

- [ ] **Step 2: Add browser popup-blocked recovery test**

Before app code runs, override `window.open` to return null. Start Timer, assert the localized
failure notice and Retry button, then enable a captured native `window.open`, click Retry, and
assert a projection page opens:

```ts
await page.addInitScript(() => {
  const nativeOpen = window.open.bind(window)
  Object.defineProperty(window, '__allowProjectionPopup', {
    value: false,
    writable: true
  })
  window.open = (...args) =>
    window.__allowProjectionPopup ? nativeOpen(...args) : null
})
// After asserting the blocked notice:
await page.evaluate(() => {
  window.__allowProjectionPopup = true
})
const projectionPromise = context.waitForEvent('page')
await page.getByRole('button', { name: /retry projection/i }).click()
const projection = await projectionPromise
await expect(projection.locator('.timer-digits').first()).toBeVisible()
```

Extend the test-only global `Window` declaration with `__allowProjectionPopup: boolean`.

- [ ] **Step 3: Add packaged Electron reload replay**

After the packaged projection shows Timer:

```ts
await projection.reload()
await expect(projection.locator('.timer-digits').first()).toBeVisible()
await projection.waitForTimeout(1200)
expect(electronApp!.windows()).toHaveLength(2)
```

- [ ] **Step 4: Run browser E2E**

```bash
npm run test:e2e:browser
```

Expected: reload and popup recovery pass; passive timer ticks remain non-activating.

- [ ] **Step 5: Build unpacked app and run packaged E2E**

```bash
npm run build:unpack
```

From WSL, pass the required variable through Windows shell:

```bash
cmd.exe /d /s /c "set PACKAGED_APP_PATH=dist\\win-unpacked\\libre-presenter.exe&& npm run test:e2e:packaged"
```

- [ ] **Step 6: Commit**

```bash
git add e2e/browser-projection.spec.ts e2e/electron-packaged.spec.ts playwright.config.ts
git commit -m "test: cover projection session recovery"
```

Only stage `playwright.config.ts` if it actually changed.

---

### Task 10: Remove Old Lifecycle Bypasses and Close R3

**Files:**

- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`
- Modify: obsolete projection files only when identified by the searches below

- [ ] **Step 1: Search for obsolete ungenerated transport and readiness assumptions**

```bash
rg -n "projection:opened|projection:closed|readyResolveRef|pendingPayloadsRef|autoOpenTimeoutRef|isReadyRef\\.current = true" src
rg -n "send\\('__system:ready', null\\)|sendToMain\\('__system:ready', null\\)" src
rg -n "projection:message', '[^0-9]|projection:message\", \"[^0-9]" src/main src/renderer/src
```

Expected: no old opened/closed lifecycle subscriptions, null ready payloads, legacy pending refs,
or ungenerated projection transport calls.

- [ ] **Step 2: Run the complete focused R3 suite**

```bash
npx vitest run src/main/__tests__/ipc/validate.test.ts src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/main/__tests__/windowManager.test.ts src/main/__tests__/ipc/projection.test.ts src/main/__tests__/ipc/projection-vlc.test.ts src/renderer/src/lib/__tests__/projection-adapter.test.ts src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/lib/__tests__/projection-render-state.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.editable-payload.test.tsx src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx
```

- [ ] **Step 3: Run broad deterministic gates**

```bash
npm run typecheck
npm run lint
npx vitest run
npm run build
npm run test:e2e:browser
```

- [ ] **Step 4: Run Windows packaged gates**

```bash
npm run build:unpack
cmd.exe /d /s /c "set PACKAGED_APP_PATH=dist\\win-unpacked\\libre-presenter.exe&& npm run test:e2e:packaged"
```

- [ ] **Step 5: Audit every R3 acceptance criterion**

Record exact evidence for:

- display move generation and replay;
- reload replay;
- first crash automatic recreation;
- second crash inside 30 seconds failure and Retry;
- explicit close session removal;
- native video and VLC playing/paused restoration;
- PDF/image/presentation final-state restoration;
- stale generation rejection at timeout, adapter, IPC, and page layers;
- popup-blocked and ready-timeout results;
- no recovery foreground loop;
- internal-only `DefaultProjection`.

Treat any criterion without direct test or runtime evidence as incomplete.

- [ ] **Step 6: Update the roadmap with exact evidence**

Change R3 status to Complete only after focused, full, static, browser, build, and Windows packaged
gates pass. Add a dated progress section with exact file/test counts and explicitly state that
macOS packaged recovery remains enforced by release CI.

- [ ] **Step 7: Format, diff-check, and commit**

```bash
npx prettier --check docs/roadmap/librepresenter-optimization-roadmap.md
git diff --check
git add docs/roadmap/librepresenter-optimization-roadmap.md
git commit -m "docs: complete R3 projection session recovery"
```
