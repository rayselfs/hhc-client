import type { ContentMessageTuple, ProjectionOwner } from '@renderer/contexts/ProjectionContext'
import { isBibleRoute, isFilesRoute, isTimerRoute } from '@renderer/lib/routes'
import type { MediaTypeStateMap } from '@renderer/lib/presentability'
import { useBibleProjectionStore } from '@renderer/stores/bible-projection'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useSettingsStore } from '@renderer/stores/settings'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { selectFormattedTime } from '@renderer/stores/selectors/stopwatch'
import { getDisplayValues, useTimerStore } from '@renderer/stores/timer'
import type { PresentationReadinessReport } from '@renderer/lib/presentation-readiness'
import type { FileItemRecord } from '@shared/types/folder'

export type ProjectionHeaderDisabledReason =
  | 'no-bible-payload'
  | 'no-presentable-items'
  | 'unsupported-route'

export interface ProjectionHeaderState {
  disabled: boolean
  reason?: ProjectionHeaderDisabledReason
}

interface ProjectionHeaderStateInput {
  pathname: string
  isProjectionOpen: boolean
  biblePayloads: ContentMessageTuple[] | null
  presentableItems: FileItemRecord[]
}

interface ProjectionStartDeps {
  startProjection: (owner: ProjectionOwner, payloads?: ContentMessageTuple[]) => Promise<unknown>
}

interface ProjectionStopDeps {
  stopProjection: () => Promise<void>
}

interface CloseProjectionSessionDeps {
  closeProjection: () => Promise<void>
  endLiveSession: () => void
}

interface StartMediaProjectionDeps {
  startMediaPresentation?: (
    items: FileItemRecord[],
    startIndex: number,
    options?: {
      prioritizeStartItem?: boolean
      presentationState?: MediaTypeStateMap['presentation']
    }
  ) => Promise<PresentationReadinessReport>
  onNoProjectableFiles?: () => void
}

interface PresentPreviewInput {
  item: FileItemRecord
  playlist: FileItemRecord[]
  start: (
    items: FileItemRecord[],
    startIndex: number,
    deps: Record<string, never>,
    options: { prioritizeStartItem: true }
  ) => Promise<PresentationReadinessReport>
  navigate: (path: string) => void
}

interface StartProjectionForRouteInput {
  pathname: string
  startProjection: (owner: ProjectionOwner, payloads?: ContentMessageTuple[]) => Promise<unknown>
  biblePayloads: ContentMessageTuple[] | null
  presentableItems: FileItemRecord[]
  startMediaPresentation: (
    items: FileItemRecord[],
    startIndex: number,
    options?: { prioritizeStartItem?: boolean }
  ) => Promise<PresentationReadinessReport>
  onNoProjectableFiles: () => void
}

export function getProjectionHeaderState({
  pathname,
  isProjectionOpen,
  biblePayloads,
  presentableItems
}: ProjectionHeaderStateInput): ProjectionHeaderState {
  if (isProjectionOpen) return { disabled: false }
  if (isTimerRoute(pathname)) return { disabled: false }
  if (isBibleRoute(pathname)) {
    return biblePayloads ? { disabled: false } : { disabled: true, reason: 'no-bible-payload' }
  }
  if (isFilesRoute(pathname)) {
    return presentableItems.length > 0
      ? { disabled: false }
      : { disabled: true, reason: 'no-presentable-items' }
  }
  return { disabled: true, reason: 'unsupported-route' }
}

export function getTimerProjectionPayloads(): ContentMessageTuple[] {
  const timer = useTimerStore.getState()
  const stopwatch = useStopwatchStore.getState()
  const settings = useSettingsStore.getState()
  const displayValues = getDisplayValues({
    phase: timer.phase,
    remainingSeconds: timer.remainingSeconds,
    reminderDuration: timer.reminderDuration,
    overtimeSeconds: timer.overtimeSeconds,
    totalDuration: timer.totalDuration,
    reminderEnabled: timer.reminderEnabled
  })
  const projectionMode =
    timer.mode === 'stopwatch' && !stopwatch.showOnProjection ? 'clock' : timer.mode
  const payloads: ContentMessageTuple[] = [
    ['settings:timezone', { timezone: settings.timezone }],
    [
      'settings:timer-ring-color',
      { color: settings.timerRingColorEnabled ? settings.timerRingColor : null }
    ],
    [
      'timer:tick',
      {
        mode: projectionMode,
        remainingSeconds: timer.remainingSeconds,
        phase: timer.phase,
        mainDisplay: displayValues.mainDisplay,
        subDisplay: displayValues.subDisplay,
        progress: timer.progress,
        overtimeSeconds: timer.overtimeSeconds,
        overtimeMessage: timer.overtimeMessageEnabled ? timer.overtimeMessage : null,
        reminderColor: timer.reminderEnabled ? timer.reminderColor : null
      }
    ]
  ]

  if (timer.mode === 'stopwatch' && stopwatch.showOnProjection) {
    payloads.push([
      'timer:stopwatch',
      {
        elapsedMs: stopwatch.elapsedMs,
        formattedTime: selectFormattedTime(stopwatch),
        status: stopwatch.status
      }
    ])
  }

  return payloads
}

export async function startTimerProjection({
  startProjection
}: ProjectionStartDeps): Promise<void> {
  await startProjection('timer', getTimerProjectionPayloads())
}

export async function startBibleProjection(
  payloads: ContentMessageTuple[],
  { startProjection }: ProjectionStartDeps
): Promise<void> {
  useBibleProjectionStore.getState().setLastPayloads(payloads)
  await startProjection('bible', payloads)
}

export async function startMediaProjection(
  items: FileItemRecord[],
  startIndex: number,
  deps: StartMediaProjectionDeps = {},
  options?: {
    prioritizeStartItem?: boolean
    presentationState?: MediaTypeStateMap['presentation']
  }
): Promise<PresentationReadinessReport> {
  const startMediaPresentation =
    deps.startMediaPresentation ?? useMediaProjectionStore.getState().startPresentationWithReadiness
  const report = await startMediaPresentation(items, startIndex, options)
  if (report.summary.ready === 0) deps.onNoProjectableFiles?.()
  return report
}

export async function stopProjectionSession({ stopProjection }: ProjectionStopDeps): Promise<void> {
  await stopProjection()
}

export async function closeProjectionAndMediaSession({
  closeProjection,
  endLiveSession
}: CloseProjectionSessionDeps): Promise<void> {
  await closeProjection()
  endLiveSession()
}

export async function presentPreviewItem({
  item,
  playlist,
  start,
  navigate
}: PresentPreviewInput): Promise<string | null> {
  const startIndex = playlist.findIndex((entry) => entry.id === item.id)
  if (startIndex < 0) return 'not-presentable'

  const report = await start(playlist, startIndex, {}, { prioritizeStartItem: true })
  const requested = report.items.find((entry) => entry.itemId === item.id)
  if (requested?.status !== 'ready') return requested?.reason ?? 'not-ready'

  navigate('/media')
  return null
}

export async function startProjectionForRoute({
  pathname,
  startProjection,
  biblePayloads,
  presentableItems,
  startMediaPresentation,
  onNoProjectableFiles
}: StartProjectionForRouteInput): Promise<void> {
  if (isTimerRoute(pathname)) {
    await startTimerProjection({ startProjection })
    return
  }

  if (isBibleRoute(pathname)) {
    if (biblePayloads) await startBibleProjection(biblePayloads, { startProjection })
    return
  }

  if (isFilesRoute(pathname) && presentableItems.length > 0) {
    await startMediaProjection(presentableItems, 0, {
      startMediaPresentation,
      onNoProjectableFiles
    })
  }
}
