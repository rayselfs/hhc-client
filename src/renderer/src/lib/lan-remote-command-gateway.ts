import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { useTimerStore } from '@renderer/stores/timer'
import {
  sanitizeLanRemoteSnapshot,
  type LanRemoteAck,
  type LanRemoteCommand
} from '@shared/lan-remote'
import type { LanRemoteSnapshot } from '@shared/lan-remote'

let revision = 0

function rejected(requestId: string, reason: string): LanRemoteAck {
  return { requestId, status: 'rejected', reason }
}

function accept(requestId: string): LanRemoteAck {
  revision += 1
  return { requestId, status: 'accepted' }
}

export async function executeLanRemoteCommand(command: LanRemoteCommand): Promise<LanRemoteAck> {
  if (
    'requiredRevision' in command &&
    command.requiredRevision !== undefined &&
    command.requiredRevision !== revision
  ) {
    return rejected(command.requestId, 'stale-revision')
  }

  const projection = useMediaProjectionStore.getState()

  switch (command.type) {
    case 'presentation:prev':
      projection.prev()
      return accept(command.requestId)
    case 'presentation:next':
      projection.next()
      return accept(command.requestId)
    case 'presentation:jump':
      projection.jumpTo(command.index)
      return accept(command.requestId)
    case 'media:play':
      projection.setTypeState('video', {
        ...projection.getTypeState('video'),
        hasStarted: true,
        isPlaying: true,
        isEnded: false
      })
      return accept(command.requestId)
    case 'media:pause':
      projection.setTypeState('video', {
        ...projection.getTypeState('video'),
        isPlaying: false
      })
      return accept(command.requestId)
    case 'timer:command':
      if (!window.api?.timer) return rejected(command.requestId, 'timer-api-unavailable')
      await window.api.timer.timerCommand(command.command)
      return accept(command.requestId)
  }
}

export function createLanRemoteSnapshot(isProjectionOpen: boolean): LanRemoteSnapshot {
  const projection = useMediaProjectionStore.getState()
  const timer = useTimerStore.getState()
  const stopwatch = useStopwatchStore.getState()
  const current = projection.currentItem()
  const next = projection.nextItem()

  return sanitizeLanRemoteSnapshot({
    revision,
    presentation: {
      currentIndex: projection.currentIndex,
      total: projection.playlist.length,
      currentName: current?.name ?? null,
      nextName: next?.name ?? null,
      canPrevious: projection.canPrev(),
      canNext: projection.canNext(),
      isPlaying: projection.isPresenting
    },
    projection: {
      isOpen: isProjectionOpen
    },
    timer: {
      status: timer.status,
      remainingSeconds: timer.remainingSeconds
    },
    stopwatch: {
      status: stopwatch.status,
      elapsedMs: stopwatch.elapsedMs
    }
  })
}
