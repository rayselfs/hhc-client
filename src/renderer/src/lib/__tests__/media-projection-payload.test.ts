import { describe, expect, it } from 'vitest'
import { buildFileProjectionPayload } from '../media-projection-payload'
import type { PresentationSnapshot } from '../presentation-readiness'
import type { FileItemRecord } from '@shared/types/folder'

function makeFile(id: string, url = `blob:${id}`): FileItemRecord {
  return {
    id,
    type: 'file',
    parentId: 'root',
    sortIndex: 0,
    createdAt: 0,
    expiresAt: null,
    name: `${id}.mp4`,
    url,
    size: 100,
    mimeType: 'video/mp4'
  }
}

describe('buildFileProjectionPayload', () => {
  it('builds a file projection payload from snapshot metadata', () => {
    const playlist = [makeFile('copy-id', 'blob:original-id')]
    const snapshot: PresentationSnapshot = {
      id: 'snapshot-1',
      createdAt: 0,
      entries: [
        {
          index: 0,
          itemId: 'copy-id',
          blobId: 'original-id',
          name: 'copy.mp4',
          mimeType: 'video/mp4',
          sourceUrl: 'blob:original-id',
          playbackMode: 'vlc-embedded',
          seekable: true,
          durationMs: 1234
        }
      ]
    }

    expect(buildFileProjectionPayload({ playlist, currentIndex: 0, snapshot })).toEqual({
      itemId: 'copy-id',
      blobId: 'original-id',
      fileName: 'copy-id.mp4',
      mimeType: 'video/mp4',
      playlist: [{ id: 'copy-id', name: 'copy-id.mp4', mimeType: 'video/mp4' }],
      currentIndex: 0,
      playbackMode: 'vlc-embedded',
      seekable: true,
      durationMs: 1234
    })
  })

  it('returns null when the current index has no item', () => {
    expect(buildFileProjectionPayload({ playlist: [], currentIndex: 0 })).toBeNull()
  })
})
