import { isValidNativeFileId } from '@shared/native-media'
import { isElectron } from './env'
import { getFileBlobRecord } from './file-explorer-db'
import { MediaJobBlockedError, mediaJobQueue } from './media-job-queue'
import {
  getDerivedAsset,
  listMediaJobs,
  putDerivedAsset,
  putMediaJob,
  type DerivedAssetMetadata,
  type DerivedAssetRecord,
  type MediaJobRecord
} from './media-work-db'

export const TRANSCODE_COMPATIBILITY_PROFILE = {
  variant: 'mp4-h264-aac-yuv420p-faststart',
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  pixelFormat: 'yuv420p',
  fastStart: true,
  mimeType: 'video/mp4'
} as const

export type TranscodedVideoMetadata = DerivedAssetMetadata & {
  container: string
  videoCodec: string
  profile: string
}

export function createTranscodeDedupeKey(
  sourceBlobId: string,
  variant = TRANSCODE_COMPATIBILITY_PROFILE.variant
): string {
  return `transcode:${sourceBlobId}:${variant}`
}

export async function enqueueTranscodeJob(input: {
  sourceBlobId: string
  itemId: string
  priority?: number
}): Promise<MediaJobRecord> {
  await putDerivedAsset({
    sourceBlobId: input.sourceBlobId,
    kind: 'transcoded-video',
    variant: TRANSCODE_COMPATIBILITY_PROFILE.variant,
    storage: 'native-fs',
    mimeType: TRANSCODE_COMPATIBILITY_PROFILE.mimeType,
    status: 'building',
    metadata: {
      container: TRANSCODE_COMPATIBILITY_PROFILE.container,
      videoCodec: TRANSCODE_COMPATIBILITY_PROFILE.videoCodec,
      audioCodec: TRANSCODE_COMPATIBILITY_PROFILE.audioCodec,
      pixelFormat: TRANSCODE_COMPATIBILITY_PROFILE.pixelFormat,
      fastStart: TRANSCODE_COMPATIBILITY_PROFILE.fastStart,
      profile: TRANSCODE_COMPATIBILITY_PROFILE.variant
    }
  })

  const job = await mediaJobQueue.enqueue({
    type: 'transcode',
    sourceBlobId: input.sourceBlobId,
    itemId: input.itemId,
    priority: input.priority,
    dedupeKey: createTranscodeDedupeKey(input.sourceBlobId)
  })
  return blockJobIfFfmpegIsNotReady(job)
}

async function blockJobIfFfmpegIsNotReady(job: MediaJobRecord): Promise<MediaJobRecord> {
  if (!isElectron()) return job

  try {
    const config = await window.api.videoTranscode.getFfmpegConfig()
    if (config.status === 'ready') return job
    const blockedJob: MediaJobRecord = {
      ...job,
      status: 'blocked',
      blockedReason: 'configuration',
      errorCode: config.status,
      updatedAt: Date.now()
    }
    await putMediaJob(blockedJob)
    console.warn('[media-transcode] Transcode job blocked', {
      jobId: job.id,
      sourceBlobId: job.sourceBlobId,
      itemId: job.itemId,
      reason: config.status
    })
    return blockedJob
  } catch (error) {
    const blockedJob: MediaJobRecord = {
      ...job,
      status: 'blocked',
      blockedReason: 'configuration',
      errorCode: error instanceof Error ? error.message : 'ffmpeg-config-unavailable',
      updatedAt: Date.now()
    }
    await putMediaJob(blockedJob)
    console.warn('[media-transcode] Transcode job blocked', {
      jobId: job.id,
      sourceBlobId: job.sourceBlobId,
      itemId: job.itemId,
      reason: blockedJob.errorCode
    })
    return blockedJob
  }
}

export async function retryBlockedTranscodeJobs(): Promise<number> {
  if (!isElectron()) return 0

  const config = await window.api.videoTranscode.getFfmpegConfig()
  if (config.status !== 'ready') return 0

  const jobs = await listMediaJobs()
  const blockedJobs = jobs.filter(
    (job) =>
      job.type === 'transcode' && job.status === 'blocked' && job.blockedReason === 'configuration'
  )
  await Promise.all(blockedJobs.map((job) => mediaJobQueue.retry(job.id)))
  return blockedJobs.length
}

export async function markTranscodedVideoReady(input: {
  sourceBlobId: string
  nativeFileId: string
  size: number
  metadata?: Partial<TranscodedVideoMetadata>
}): Promise<DerivedAssetRecord> {
  if (!isValidNativeFileId(input.nativeFileId)) {
    throw new Error('Invalid transcoded video native file id')
  }

  return putDerivedAsset({
    sourceBlobId: input.sourceBlobId,
    kind: 'transcoded-video',
    variant: TRANSCODE_COMPATIBILITY_PROFILE.variant,
    storage: 'native-fs',
    mimeType: TRANSCODE_COMPATIBILITY_PROFILE.mimeType,
    size: input.size,
    status: 'ready',
    nativeFileId: input.nativeFileId,
    metadata: {
      container: input.metadata?.container ?? TRANSCODE_COMPATIBILITY_PROFILE.container,
      videoCodec: input.metadata?.videoCodec ?? TRANSCODE_COMPATIBILITY_PROFILE.videoCodec,
      audioCodec: input.metadata?.audioCodec ?? TRANSCODE_COMPATIBILITY_PROFILE.audioCodec,
      width: input.metadata?.width,
      height: input.metadata?.height,
      durationMs: input.metadata?.durationMs,
      pixelFormat: input.metadata?.pixelFormat ?? TRANSCODE_COMPATIBILITY_PROFILE.pixelFormat,
      fastStart: input.metadata?.fastStart ?? TRANSCODE_COMPATIBILITY_PROFILE.fastStart,
      profile: input.metadata?.profile ?? TRANSCODE_COMPATIBILITY_PROFILE.variant
    }
  })
}

export async function markTranscodedVideoFailed(
  sourceBlobId: string,
  metadata?: Partial<TranscodedVideoMetadata>
): Promise<DerivedAssetRecord> {
  return putDerivedAsset({
    sourceBlobId,
    kind: 'transcoded-video',
    variant: TRANSCODE_COMPATIBILITY_PROFILE.variant,
    storage: 'native-fs',
    mimeType: TRANSCODE_COMPATIBILITY_PROFILE.mimeType,
    status: 'failed',
    metadata: {
      container: metadata?.container ?? TRANSCODE_COMPATIBILITY_PROFILE.container,
      videoCodec: metadata?.videoCodec ?? TRANSCODE_COMPATIBILITY_PROFILE.videoCodec,
      audioCodec: metadata?.audioCodec ?? TRANSCODE_COMPATIBILITY_PROFILE.audioCodec,
      pixelFormat: metadata?.pixelFormat ?? TRANSCODE_COMPATIBILITY_PROFILE.pixelFormat,
      fastStart: metadata?.fastStart ?? TRANSCODE_COMPATIBILITY_PROFILE.fastStart,
      profile: metadata?.profile ?? TRANSCODE_COMPATIBILITY_PROFILE.variant
    }
  })
}

export async function getReadyTranscodedVideo(
  sourceBlobId: string
): Promise<DerivedAssetRecord | null> {
  const asset = await getDerivedAsset(
    sourceBlobId,
    'transcoded-video',
    TRANSCODE_COMPATIBILITY_PROFILE.variant
  )
  return asset?.status === 'ready' ? asset : null
}

mediaJobQueue.registerExecutor('transcode', async (job, { signal }) => {
  if (!job.sourceBlobId || !job.itemId) throw new Error('Transcode job is missing source identity')
  if (!isElectron())
    throw new MediaJobBlockedError('configuration', 'Transcoding requires Electron')

  const sourceRecord = await getFileBlobRecord(job.sourceBlobId)
  if (sourceRecord?.storage !== 'native-fs') {
    throw new Error('Transcode source is not available in native storage')
  }

  const config = await window.api.videoTranscode.getFfmpegConfig()
  if (config.status !== 'ready') {
    console.warn('[media-transcode] Transcode job blocked', {
      jobId: job.id,
      sourceBlobId: job.sourceBlobId,
      itemId: job.itemId,
      reason: config.status
    })
    throw new MediaJobBlockedError('configuration', config.status)
  }

  const outputFileId = crypto.randomUUID()
  const cancel = (): void => {
    void window.api.videoTranscode.cancel(job.id)
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    const result = await window.api.videoTranscode.run({
      jobId: job.id,
      sourceFileId: job.sourceBlobId,
      outputFileId
    })
    if (signal.aborted) {
      await window.api.nativeFs.delete(result.outputFileId).catch(() => undefined)
      return
    }
    await markTranscodedVideoReady({
      sourceBlobId: job.sourceBlobId,
      nativeFileId: result.outputFileId,
      size: result.size
    })
  } catch (error) {
    await markTranscodedVideoFailed(job.sourceBlobId)
    console.error('[media-transcode] Failed to transcode video', {
      jobId: job.id,
      sourceBlobId: job.sourceBlobId,
      itemId: job.itemId,
      error
    })
    throw error
  } finally {
    signal.removeEventListener('abort', cancel)
  }
})
