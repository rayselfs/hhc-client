import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTranscodeDedupeKey,
  enqueueTranscodeJob,
  getReadyTranscodedVideo,
  markTranscodedVideoFailed,
  markTranscodedVideoReady,
  retryBlockedTranscodeJobs,
  TRANSCODE_COMPATIBILITY_PROFILE
} from '../media-transcode-lifecycle'
import {
  getDerivedAsset,
  getMediaJob,
  putMediaJob,
  resetMediaWorkDBForTests
} from '../media-work-db'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'

describe('media transcode lifecycle', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: undefined
    })
    await resetMediaWorkDBForTests()
    await resetFileExplorerDBForTests()
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
    await (await openFileExplorerDB()).put('file-blobs', {
      id: 'source-blob-1',
      storage: 'native-fs',
      refCount: 1
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
    await vi.waitFor(async () => {
      await expect(getMediaJob(job.id)).resolves.toMatchObject({
        status: 'blocked',
        blockedReason: 'configuration'
      })
    })
  })

  it('runs Electron transcode jobs and stores the ready derivative', async () => {
    const sourceBlobId = '123e4567-e89b-12d3-a456-426614174000'
    const outputFileId = '223e4567-e89b-12d3-a456-426614174000'
    const run = vi.fn().mockResolvedValue({ outputFileId, size: 4096 })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoTranscode: {
          getFfmpegConfig: async () => ({ status: 'ready' }),
          run,
          cancel: vi.fn()
        },
        nativeFs: {
          delete: vi.fn()
        }
      }
    })
    await (await openFileExplorerDB()).put('file-blobs', {
      id: sourceBlobId,
      storage: 'native-fs',
      refCount: 1
    })

    const job = await enqueueTranscodeJob({
      sourceBlobId,
      itemId: 'original-item'
    })

    await vi.waitFor(async () => {
      await expect(getReadyTranscodedVideo(sourceBlobId)).resolves.toMatchObject({
        status: 'ready',
        nativeFileId: outputFileId,
        size: 4096
      })
    })
    expect(run).toHaveBeenCalledWith({
      jobId: job.id,
      sourceFileId: sourceBlobId,
      outputFileId: expect.any(String)
    })
  })

  it('does not run FFmpeg when the source is not native storage', async () => {
    const sourceBlobId = '123e4567-e89b-12d3-a456-426614174000'
    const run = vi.fn()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoTranscode: {
          getFfmpegConfig: async () => ({ status: 'ready' }),
          run,
          cancel: vi.fn()
        },
        nativeFs: {
          delete: vi.fn()
        }
      }
    })

    const job = await enqueueTranscodeJob({
      sourceBlobId,
      itemId: 'original-item'
    })

    await vi.waitFor(async () => {
      await expect(getMediaJob(job.id)).resolves.toMatchObject({ status: 'failed' })
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('retries blocked transcode jobs when FFmpeg becomes ready', async () => {
    const sourceBlobId = '323e4567-e89b-12d3-a456-426614174000'
    const outputFileId = '423e4567-e89b-12d3-a456-426614174000'
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoTranscode: {
          getFfmpegConfig: vi.fn().mockResolvedValue({ status: 'ready' }),
          run: vi.fn().mockResolvedValue({ outputFileId, size: 8192 }),
          cancel: vi.fn()
        },
        nativeFs: {
          delete: vi.fn()
        }
      }
    })

    const job = {
      id: 'blocked-transcode-job',
      type: 'transcode' as const,
      sourceBlobId,
      itemId: 'original-item',
      dedupeKey: createTranscodeDedupeKey(sourceBlobId),
      priority: 0,
      status: 'blocked' as const,
      progress: 0,
      attempt: 0,
      blockedReason: 'configuration' as const,
      errorCode: 'not-configured',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    await putMediaJob(job)
    await (await openFileExplorerDB()).put('file-blobs', {
      id: sourceBlobId,
      storage: 'native-fs',
      refCount: 1
    })

    expect(job.status).toBe('blocked')
    await expect(retryBlockedTranscodeJobs()).resolves.toBe(1)
    await vi.waitFor(async () => {
      await expect(getReadyTranscodedVideo(sourceBlobId)).resolves.toMatchObject({
        status: 'ready',
        nativeFileId: outputFileId,
        size: 8192
      })
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
