import { isValidNativeFileId } from '@shared/native-media'
import { mediaJobQueue } from './media-job-queue'
import {
  getDerivedAsset,
  putDerivedAsset,
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

  return mediaJobQueue.enqueue({
    type: 'transcode',
    sourceBlobId: input.sourceBlobId,
    itemId: input.itemId,
    priority: input.priority,
    dedupeKey: createTranscodeDedupeKey(input.sourceBlobId)
  })
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
