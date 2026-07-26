import type {
  ProjectionChannel,
  ProjectionContentMessageTuple,
  ProjectionFailure,
  ProjectionLifecycleEvent,
  ProjectionLifecycleStatus,
  ProjectionOperationResult,
  ProjectionOwner,
  ProjectionPayload,
  ProjectionSessionSnapshot
} from '@shared/projection-messages'

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
  project<C extends ReplayableProjectionChannel>(channel: C, data: ProjectionPayload<C>): void
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

function createEmptySnapshot(owner: ProjectionOwner): ProjectionSessionSnapshot {
  return {
    owner,
    showDefault: false,
    timer: {
      tick: null,
      stopwatch: null,
      overtimeMessage: null,
      timezone: null,
      ringColor: null
    },
    bible: {
      chapter: null,
      settings: null
    },
    media: {
      show: null,
      state: null
    }
  }
}

function reduceFileControl(
  snapshot: ProjectionSessionSnapshot,
  data: ProjectionPayload<'file:control'>
): ProjectionSessionSnapshot {
  const current = snapshot.media.state
  if (!current) return snapshot
  if ('itemId' in data && data.itemId !== undefined && data.itemId !== current.itemId) {
    return snapshot
  }

  let state = current
  switch (data.action) {
    case 'play':
      state = { ...current, isPlaying: true, isEnded: false }
      break
    case 'pause':
      state = { ...current, isPlaying: false }
      break
    case 'seek':
      state = { ...current, positionSeconds: data.value, isEnded: false }
      break
    case 'volume':
      state = { ...current, volume: data.value }
      break
    case 'pdfPage':
      state = { ...current, pdfPage: data.value }
      break
    case 'pdfScroll':
      state = { ...current, pdfScroll: data.value }
      break
    case 'pdfViewMode':
      state = { ...current, pdfViewMode: data.value }
      break
    case 'zoom':
      state = { ...current, zoom: data.value }
      break
    case 'pan':
      state = { ...current, pan: { ...data.value } }
      break
  }

  return {
    ...snapshot,
    media: {
      ...snapshot.media,
      state
    }
  }
}

function reduceReplayableMessage(
  snapshot: ProjectionSessionSnapshot,
  channel: ReplayableProjectionChannel,
  data: ProjectionPayload<ReplayableProjectionChannel>
): ProjectionSessionSnapshot {
  switch (channel) {
    case 'timer:tick':
      return {
        ...snapshot,
        timer: { ...snapshot.timer, tick: data as ProjectionPayload<'timer:tick'> }
      }
    case 'timer:stopwatch':
      return {
        ...snapshot,
        timer: {
          ...snapshot.timer,
          stopwatch: data as ProjectionPayload<'timer:stopwatch'>
        }
      }
    case 'timer:overtime-message':
      return {
        ...snapshot,
        timer: {
          ...snapshot.timer,
          overtimeMessage: data as ProjectionPayload<'timer:overtime-message'>
        }
      }
    case 'settings:timezone':
      return {
        ...snapshot,
        timer: {
          ...snapshot.timer,
          timezone: data as ProjectionPayload<'settings:timezone'>
        }
      }
    case 'settings:timer-ring-color':
      return {
        ...snapshot,
        timer: {
          ...snapshot.timer,
          ringColor: data as ProjectionPayload<'settings:timer-ring-color'>
        }
      }
    case 'bible:chapter':
      return {
        ...snapshot,
        bible: {
          ...snapshot.bible,
          chapter: data as ProjectionPayload<'bible:chapter'>
        }
      }
    case 'bible:settings':
      return {
        ...snapshot,
        bible: {
          ...snapshot.bible,
          settings: data as ProjectionPayload<'bible:settings'>
        }
      }
    case 'file:show': {
      const show = data as ProjectionPayload<'file:show'>
      return {
        ...snapshot,
        media: {
          show,
          state: {
            itemId: show.itemId,
            ...DEFAULT_MEDIA_REPLAY_STATE,
            pan: { ...DEFAULT_MEDIA_REPLAY_STATE.pan }
          }
        }
      }
    }
    case 'file:control':
      return reduceFileControl(snapshot, data as ProjectionPayload<'file:control'>)
    case 'timer:sync':
      return snapshot
  }
}

function reducePlaybackState(
  snapshot: ProjectionSessionSnapshot,
  data: ProjectionPayload<'file:playback-state'>
): ProjectionSessionSnapshot {
  if (!snapshot.media.state || snapshot.media.state.itemId !== data.itemId) return snapshot
  return {
    ...snapshot,
    media: {
      ...snapshot.media,
      state: {
        ...snapshot.media.state,
        positionSeconds: data.currentTime,
        durationSeconds: data.duration,
        isPlaying: data.isPlaying,
        isEnded: data.isEnded
      }
    }
  }
}

export function createProjectionSessionCoordinator(
  send: ProjectionCoordinatorSend,
  readyTimeoutMs = 5000
): ProjectionSessionCoordinator {
  let snapshot: ProjectionSessionSnapshot | null = null
  let recovery: ProjectionRecoveryState = {
    status: 'closed',
    generation: 0,
    failure: null
  }
  let replayedGeneration = 0
  let disposed = false
  let readyTimer: ReturnType<typeof setTimeout> | null = null
  let waiter: {
    generation: number
    promise: Promise<ProjectionOperationResult>
    resolve: (result: ProjectionOperationResult) => void
  } | null = null
  const listeners = new Set<() => void>()

  const notify = (): void => {
    if (disposed) return
    for (const listener of listeners) listener()
  }

  const clearReadyTimer = (): void => {
    if (readyTimer !== null) {
      clearTimeout(readyTimer)
      readyTimer = null
    }
  }

  const resolveWaiter = (result: ProjectionOperationResult): void => {
    clearReadyTimer()
    const current = waiter
    waiter = null
    current?.resolve(result)
  }

  const scheduleReadyTimeout = (): void => {
    clearReadyTimer()
    if (!waiter || disposed) return
    const generation = waiter.generation
    readyTimer = setTimeout(() => {
      if (!waiter || waiter.generation !== generation || disposed) return
      api.fail(generation, 'ready-timeout')
    }, readyTimeoutMs)
  }

  const api: ProjectionSessionCoordinator = {
    startSession(owner, payloads) {
      snapshot = createEmptySnapshot(owner)
      for (const [channel, data] of payloads) {
        if (channel === 'file:end') continue
        snapshot = reduceReplayableMessage(
          snapshot,
          channel,
          data as ProjectionPayload<ReplayableProjectionChannel>
        )
      }
      if (recovery.status === 'ready' && recovery.generation > 0) {
        send('__system:replay', {
          generation: recovery.generation,
          snapshot
        })
      }
      notify()
    },

    claim(owner, unblank = false) {
      if (!snapshot) snapshot = createEmptySnapshot(owner)
      snapshot = {
        ...snapshot,
        owner,
        showDefault: unblank ? false : snapshot.showDefault
      }
      if (recovery.status === 'ready') {
        send('__system:active-owner', { owner })
        if (unblank) send('__system:blank', { showDefault: false })
      }
      notify()
    },

    blank(showDefault) {
      if (!snapshot) return
      snapshot = { ...snapshot, showDefault }
      if (recovery.status === 'ready') {
        send('__system:blank', { showDefault })
      }
      notify()
    },

    project(channel, data) {
      if (!snapshot) return
      snapshot = reduceReplayableMessage(
        snapshot,
        channel,
        data as ProjectionPayload<ReplayableProjectionChannel>
      )
      if (recovery.status === 'ready') send(channel, data)
      notify()
    },

    sendOneShot(channel, data) {
      if (recovery.status === 'ready') send(channel, data)
    },

    recordPlayback(generation, data) {
      if (generation !== recovery.generation || !snapshot) return
      const next = reducePlaybackState(snapshot, data)
      if (next === snapshot) return
      snapshot = next
      notify()
    },

    beginGeneration(event) {
      if (!Number.isSafeInteger(event.generation) || event.generation <= 0) return
      if (event.generation < recovery.generation) return
      if (event.status === 'ready') {
        recovery = {
          status: 'opening',
          generation: event.generation,
          failure: null
        }
        api.ready(event.generation)
        return
      }

      if (
        event.generation === recovery.generation &&
        (event.status === 'opening' || event.status === 'recovering')
      ) {
        replayedGeneration = 0
      }
      recovery = {
        status: event.status,
        generation: event.generation,
        failure:
          event.status === 'failed' && event.reason === 'renderer-crash'
            ? { generation: event.generation, reason: 'renderer-crash' }
            : null
      }
      if (waiter && event.generation !== waiter.generation) {
        waiter.generation = event.generation
        scheduleReadyTimeout()
      }
      if (event.status === 'failed' && recovery.failure) {
        resolveWaiter({
          ok: false,
          generation: event.generation,
          reason: recovery.failure.reason
        })
      }
      notify()
    },

    ready(generation) {
      if (
        disposed ||
        generation !== recovery.generation ||
        generation <= 0 ||
        recovery.status === 'failed' ||
        replayedGeneration === generation
      ) {
        return
      }
      recovery = { status: 'ready', generation, failure: null }
      replayedGeneration = generation
      if (snapshot) {
        send('__system:replay', { generation, snapshot })
      }
      resolveWaiter({ ok: true, generation })
      notify()
    },

    fail(generation, reason) {
      if (disposed || generation !== recovery.generation || generation <= 0) return
      recovery = {
        status: 'failed',
        generation,
        failure: { generation, reason }
      }
      resolveWaiter({ ok: false, generation, reason })
      notify()
    },

    waitForReady(generation) {
      if (recovery.status === 'ready' && generation === recovery.generation) {
        return Promise.resolve({ ok: true, generation })
      }
      if (recovery.status === 'failed' && generation === recovery.generation && recovery.failure) {
        return Promise.resolve({
          ok: false,
          generation,
          reason: recovery.failure.reason
        })
      }
      if (waiter) return waiter.promise

      let resolvePromise: (result: ProjectionOperationResult) => void = () => undefined
      const promise = new Promise<ProjectionOperationResult>((resolve) => {
        resolvePromise = resolve
      })
      waiter = {
        generation,
        promise,
        resolve: resolvePromise
      }
      scheduleReadyTimeout()
      return promise
    },

    endSession() {
      const generation = recovery.generation
      snapshot = null
      replayedGeneration = 0
      recovery = { status: 'closed', generation: 0, failure: null }
      if (waiter) {
        resolveWaiter({ ok: false, generation, reason: 'ready-timeout' })
      }
      notify()
    },

    getSnapshot() {
      return snapshot
    },

    getRecoveryState() {
      return recovery
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    dispose() {
      if (disposed) return
      const generation = recovery.generation
      disposed = true
      clearReadyTimer()
      const current = waiter
      waiter = null
      current?.resolve({ ok: false, generation, reason: 'ready-timeout' })
      listeners.clear()
    }
  }

  return api
}
