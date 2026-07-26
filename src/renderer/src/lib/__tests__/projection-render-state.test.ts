import { describe, expect, it } from 'vitest'
import type { ProjectionSessionSnapshot } from '@shared/projection-messages'
import {
  initialProjectionRenderState,
  reduceProjectionRenderState,
  selectVisibleProjection
} from '../projection-render-state'

function snapshot(owner: ProjectionSessionSnapshot['owner']): ProjectionSessionSnapshot {
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
    bible: { chapter: null, settings: null },
    media: { show: null, state: null }
  }
}

it('applies a media replay in one reducer action', () => {
  const mediaSnapshot = snapshot('media')
  mediaSnapshot.media.show = {
    itemId: 'video-1',
    blobId: 'blob-1',
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    playlist: [],
    currentIndex: 0
  }
  mediaSnapshot.media.state = {
    itemId: 'video-1',
    positionSeconds: 18,
    durationSeconds: 100,
    isPlaying: true,
    isEnded: false,
    volume: 0.35,
    pdfPage: 1,
    pdfScroll: 0,
    pdfViewMode: 'single',
    zoom: 1,
    pan: { x: 0, y: 0 }
  }

  const next = reduceProjectionRenderState(initialProjectionRenderState, {
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

describe('selectVisibleProjection', () => {
  it.each([
    ['timer', 'default'],
    ['bible', 'default'],
    ['media', 'default']
  ] as const)('keeps empty %s replay on the internal fallback', (owner, visible) => {
    const next = reduceProjectionRenderState(initialProjectionRenderState, {
      type: 'replay',
      payload: { generation: 3, snapshot: snapshot(owner) }
    })
    expect(selectVisibleProjection(next)).toBe(visible)
  })
})

it('applies incremental messages after replay', () => {
  const replayed = reduceProjectionRenderState(initialProjectionRenderState, {
    type: 'replay',
    payload: { generation: 3, snapshot: snapshot('timer') }
  })
  const next = reduceProjectionRenderState(replayed, {
    type: 'message',
    channel: 'timer:overtime-message',
    data: { message: 'Finish' }
  })
  expect(next.generation).toBe(3)
  expect(next.activeContent).toBe('timer')
})
