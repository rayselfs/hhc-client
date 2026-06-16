import { beforeEach, describe, expect, it } from 'vitest'
import {
  createTranscodeDedupeKey,
  enqueueTranscodeJob,
  getReadyTranscodedVideo,
  markTranscodedVideoFailed,
  markTranscodedVideoReady,
  TRANSCODE_COMPATIBILITY_PROFILE
} from '../media-transcode-lifecycle'
import { getDerivedAsset, getMediaJob, resetMediaWorkDBForTests } from '../media-work-db'

describe('media transcode lifecycle', () => {
  beforeEach(async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: undefined
    })
    await resetMediaWorkDBForTests()
  })

  it('deduplicates copied item transcode jobs by source blob identity', async () => {
    const first = await enqueueTranscodeJob({
      sourceBlobId: 'source-blob-1',
      itemId: 'original-item'
    })
    const second = await enqueueTranscodeJob({
      sourceBlobId: 'source-blob-1',
      itemId: 'copied-item'
    })

    expect(second.id).toBe(first.id)
    expect(first.dedupeKey).toBe(createTranscodeDedupeKey('source-blob-1'))
    await expect(
      getDerivedAsset('source-blob-1', 'transcoded-video', TRANSCODE_COMPATIBILITY_PROFILE.variant)
    ).resolves.toMatchObject({
      status: 'building',
      storage: 'native-fs',
      mimeType: 'video/mp4',
      metadata: {
        profile: TRANSCODE_COMPATIBILITY_PROFILE.variant,
        videoCodec: 'h264',
        audioCodec: 'aac'
      }
    })
  })

  it('blocks Electron transcode jobs when FFmpeg is not configured', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoTranscode: {
          getFfmpegConfig: async () => ({ status: 'not-configured' })
        }
      }
    })

    const job = await enqueueTranscodeJob({
      sourceBlobId: 'source-blob-1',
      itemId: 'original-item'
    })

    expect(job).toMatchObject({
      status: 'blocked',
      blockedReason: 'configuration',
      errorCode: 'not-configured'
    })
    await expect(getMediaJob(job.id)).resolves.toMatchObject({
      status: 'blocked',
      blockedReason: 'configuration'
    })
  })

  it('persists ready transcoded video metadata with a validated native file id', async () => {
    const nativeFileId = '123e4567-e89b-12d3-a456-426614174000'

    await markTranscodedVideoReady({
      sourceBlobId: 'source-blob-1',
      nativeFileId,
      size: 2048,
      metadata: {
        width: 1920,
        height: 1080,
        durationMs: 123_000
      }
    })

    await expect(getReadyTranscodedVideo('source-blob-1')).resolves.toMatchObject({
      status: 'ready',
      nativeFileId,
      size: 2048,
      metadata: {
        container: 'mp4',
        videoCodec: 'h264',
        width: 1920,
        height: 1080,
        durationMs: 123_000,
        profile: TRANSCODE_COMPATIBILITY_PROFILE.variant
      }
    })
  })

  it('rejects invalid native file ids for transcoded outputs', async () => {
    await expect(
      markTranscodedVideoReady({
        sourceBlobId: 'source-blob-1',
        nativeFileId: '../escaped.mp4',
        size: 2048
      })
    ).rejects.toThrow('Invalid transcoded video native file id')
  })

  it('records failed transcoded video assets without exposing them as ready', async () => {
    await markTranscodedVideoFailed('source-blob-1')

    await expect(getReadyTranscodedVideo('source-blob-1')).resolves.toBeNull()
    await expect(
      getDerivedAsset('source-blob-1', 'transcoded-video', TRANSCODE_COMPATIBILITY_PROFILE.variant)
    ).resolves.toMatchObject({
      status: 'failed',
      metadata: {
        profile: TRANSCODE_COMPATIBILITY_PROFILE.variant
      }
    })
  })
})
