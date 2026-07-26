import type {
  FileControlPayload,
  ProjectionChannel,
  ProjectionMediaReplayState,
  ProjectionPayload
} from '@shared/projection-messages'

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

export const initialProjectionRenderState: ProjectionRenderState = {
  showDefault: true,
  activeContent: null,
  timerData: null,
  stopwatchData: null,
  bibleChapter: null,
  bibleSettings: { fontSize: 90 },
  fileData: null,
  mediaReplayState: null,
  fileControlEvent: null,
  timerRingColor: null,
  generation: 0
}

export function reduceProjectionRenderState(
  state: ProjectionRenderState,
  action: ProjectionRenderAction
): ProjectionRenderState {
  if (action.type === 'replay') {
    const { generation, snapshot } = action.payload
    return {
      showDefault: snapshot.showDefault,
      activeContent:
        snapshot.owner === 'media' ? 'file' : snapshot.owner === 'bible' ? 'bible' : 'timer',
      timerData: snapshot.timer.tick,
      stopwatchData: snapshot.timer.stopwatch,
      bibleChapter: snapshot.bible.chapter,
      bibleSettings: snapshot.bible.settings ?? { fontSize: 90 },
      fileData: snapshot.media.show,
      mediaReplayState: snapshot.media.state,
      fileControlEvent: null,
      timerRingColor: snapshot.timer.ringColor?.color ?? null,
      generation
    }
  }

  const { channel, data } = action
  switch (channel) {
    case '__system:blank':
      return {
        ...state,
        showDefault: (data as ProjectionPayload<'__system:blank'>).showDefault
      }
    case '__system:active-owner': {
      const owner = (data as ProjectionPayload<'__system:active-owner'>).owner
      return {
        ...state,
        activeContent: owner === 'media' ? 'file' : owner === 'bible' ? 'bible' : 'timer'
      }
    }
    case 'timer:tick':
      return {
        ...state,
        activeContent: 'timer',
        timerData: data as ProjectionPayload<'timer:tick'>
      }
    case 'timer:stopwatch':
      return { ...state, stopwatchData: data as ProjectionPayload<'timer:stopwatch'> }
    case 'bible:chapter':
      return {
        ...state,
        activeContent: 'bible',
        bibleChapter: data as ProjectionPayload<'bible:chapter'>
      }
    case 'bible:settings':
      return { ...state, bibleSettings: data as ProjectionPayload<'bible:settings'> }
    case 'file:show':
      return {
        ...state,
        activeContent: 'file',
        fileData: data as ProjectionPayload<'file:show'>,
        mediaReplayState: null
      }
    case 'file:control':
      return {
        ...state,
        fileControlEvent: {
          id: (state.fileControlEvent?.id ?? 0) + 1,
          data: data as ProjectionPayload<'file:control'>
        }
      }
    case 'settings:timer-ring-color':
      return {
        ...state,
        timerRingColor: (data as ProjectionPayload<'settings:timer-ring-color'>).color
      }
    default:
      return state
  }
}

export function selectVisibleProjection(
  state: ProjectionRenderState
): 'default' | 'timer' | 'bible' | 'file' {
  if (state.showDefault) return 'default'
  if (state.activeContent === 'timer' && state.timerData) return 'timer'
  if (state.activeContent === 'bible' && state.bibleChapter) return 'bible'
  if (state.activeContent === 'file' && state.fileData) return 'file'
  return 'default'
}
