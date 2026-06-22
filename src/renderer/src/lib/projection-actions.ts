import type { ContentMessageTuple, ProjectionOwner } from '@renderer/contexts/ProjectionContext'
import { isBibleRoute, isFilesRoute, isTimerRoute } from '@renderer/lib/routes'
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

interface MediaStartReport {
  summary: { ready: number }
}

interface StartProjectionForRouteInput {
  pathname: string
  startProjection: (owner: ProjectionOwner, payloads?: ContentMessageTuple[]) => Promise<void>
  biblePayloads: ContentMessageTuple[] | null
  presentableItems: FileItemRecord[]
  startMediaPresentation: (items: FileItemRecord[], startIndex: number) => Promise<MediaStartReport>
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

export async function startProjectionForRoute({
  pathname,
  startProjection,
  biblePayloads,
  presentableItems,
  startMediaPresentation,
  onNoProjectableFiles
}: StartProjectionForRouteInput): Promise<void> {
  if (isTimerRoute(pathname)) {
    await startProjection('timer')
    return
  }

  if (isBibleRoute(pathname)) {
    if (biblePayloads) await startProjection('bible', biblePayloads)
    return
  }

  if (isFilesRoute(pathname) && presentableItems.length > 0) {
    const report = await startMediaPresentation(presentableItems, 0)
    if (report.summary.ready === 0) onNoProjectableFiles()
  }
}
