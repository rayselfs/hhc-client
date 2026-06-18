import type { FileItemRecord } from '@shared/types/folder'
import { getBlobId } from './blob-identity'
import { isElectron } from './env'
import { getDerivedAsset } from './media-work-db'
import {
  getMediaSupport,
  resolveMediaCapability,
  type MediaPlatform,
  type MediaSupportMode
} from './media-capabilities'
import { getSyncEntryByLocalItem } from './sync-db'
import { getFileBlobRecord } from './file-explorer-db'
import { ensureSourceMediaMetadata } from './media-metadata'

export const TRANSCODE_COMPATIBILITY_VARIANT = 'mp4-h264-aac-yuv420p-faststart'

export type PresentationReadinessStatus =
  | 'ready'
  | 'preparing'
  | 'unsupported'
  | 'missing'
  | 'failed'

export interface PresentationReadiness {
  ready: number
  preparing: number
  unsupported: number
  missing: number
  failed: number
}

export interface PresentationReadinessItem {
  itemId: string
  blobId: string | null
  status: PresentationReadinessStatus
  reason: string
  support: MediaSupportMode | null
  derivativeId?: string
  playbackMode?: 'native' | 'transcoded-derivative' | 'live-transcode' | 'vlc-embedded'
  seekable?: boolean
  durationMs?: number
}

export interface PresentationReadinessReport {
  summary: PresentationReadiness
  items: PresentationReadinessItem[]
}

export interface PresentationSnapshotEntry {
  index: number
  itemId: string
  blobId: string
  name: string
  mimeType: string
  sourceUrl: string
  derivativeId?: string
  playbackMode?: 'native' | 'transcoded-derivative' | 'live-transcode' | 'vlc-embedded'
  seekable?: boolean
  durationMs?: number
}

export interface PresentationSnapshot {
  id: string
  createdAt: number
  entries: PresentationSnapshotEntry[]
}

export function getPresentationPlatform(): MediaPlatform {
  return isElectron() ? 'electron' : 'web'
}

export function createPresentationSnapshot(
  items: FileItemRecord[],
  readinessItems: PresentationReadinessItem[] = []
): PresentationSnapshot {
  const readinessByItemId = new Map(readinessItems.map((item) => [item.itemId, item]))
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    entries: items.map((item, index) => ({
      index,
      itemId: item.id,
      blobId: getBlobId(item),
      name: item.name,
      mimeType: item.mimeType,
      sourceUrl: item.url,
      derivativeId: readinessByItemId.get(item.id)?.derivativeId,
      playbackMode: readinessByItemId.get(item.id)?.playbackMode,
      seekable: readinessByItemId.get(item.id)?.seekable,
      durationMs: readinessByItemId.get(item.id)?.durationMs
    }))
  }
}

export function getPresentationSnapshotResourceIds(snapshot: PresentationSnapshot): string[] {
  const ids = new Set<string>()
  for (const entry of snapshot.entries) {
    ids.add(entry.blobId)
    if (entry.derivativeId) ids.add(entry.derivativeId)
  }
  return [...ids]
}

export async function analyzePresentationReadiness(
  items: FileItemRecord[],
  platform: MediaPlatform = getPresentationPlatform()
): Promise<PresentationReadinessReport> {
  const report: PresentationReadinessReport = {
    summary: {
      ready: 0,
      preparing: 0,
      unsupported: 0,
      missing: 0,
      failed: 0
    },
    items: []
  }

  for (const item of items) {
    const result = await analyzePresentationItem(item, platform)
    report.items.push(result)
    report.summary[result.status] += 1
  }

  return report
}

async function analyzePresentationItem(
  item: FileItemRecord,
  platform: MediaPlatform
): Promise<PresentationReadinessItem> {
  const blobId = getBlobId(item)
  if (!item.url || !blobId) {
    return {
      itemId: item.id,
      blobId: null,
      status: 'missing',
      reason: 'missing-source',
      support: null
    }
  }

  const syncEntry = await getSyncEntryByLocalItem(item.id)
  if (syncEntry && syncEntry.status !== 'available-offline') {
    if (syncEntry.status === 'failed' || syncEntry.status === 'insufficient-storage') {
      return {
        itemId: item.id,
        blobId,
        status: 'failed',
        reason: `sync-${syncEntry.status}`,
        support: null
      }
    }
    return {
      itemId: item.id,
      blobId,
      status: syncEntry.status === 'deleted-pending-release' ? 'missing' : 'preparing',
      reason: `sync-${syncEntry.status}`,
      support: null
    }
  }

  const capability = resolveMediaCapability({ mimeType: item.mimeType, fileName: item.name })
  if (!capability) {
    return {
      itemId: item.id,
      blobId,
      status: 'unsupported',
      reason: 'unsupported-media',
      support: null
    }
  }

  const support = getMediaSupport(capability, platform)
  if (support === 'unsupported') {
    return {
      itemId: item.id,
      blobId,
      status: 'unsupported',
      reason: 'unsupported-platform',
      support
    }
  }

  const metadata =
    capability.kind === 'video' ? await ensureSourceMediaMetadata(blobId, item.mimeType) : null
  const durationMs = metadata?.durationMs

  if (support === 'transcode-required') {
    if (await canUseVlcEmbedded(platform, blobId)) {
      return {
        itemId: item.id,
        blobId,
        status: 'ready',
        reason: 'ready-vlc-embedded',
        support,
        playbackMode: 'vlc-embedded',
        seekable: true,
        durationMs
      }
    }

    const derivative = await getDerivedAsset(
      blobId,
      'transcoded-video',
      TRANSCODE_COMPATIBILITY_VARIANT
    )

    if (derivative?.status === 'ready' && derivative.nativeFileId) {
      return {
        itemId: item.id,
        blobId,
        status: 'ready',
        reason: 'ready-transcoded-derivative',
        support,
        derivativeId: derivative.id,
        playbackMode: 'transcoded-derivative',
        seekable: true,
        durationMs
      }
    }

    if (derivative?.status === 'failed') {
      return {
        itemId: item.id,
        blobId,
        status: 'failed',
        reason: 'transcode-failed',
        support,
        derivativeId: derivative.id
      }
    }

    return {
      itemId: item.id,
      blobId,
      status: 'preparing',
      reason: 'transcode-required',
      support,
      derivativeId: derivative?.id
    }
  }

  return {
    itemId: item.id,
    blobId,
    status: 'ready',
    reason: 'ready-native',
    support,
    playbackMode: 'native',
    seekable: true,
    durationMs
  }
}

async function canUseVlcEmbedded(platform: MediaPlatform, blobId: string): Promise<boolean> {
  if (platform !== 'electron') return false
  try {
    const record = await getFileBlobRecord(blobId)
    if (record?.storage !== 'native-fs') return false
    const info = await window.api.projectionVlc.getInfo()
    return info.status === 'ready'
  } catch {
    return false
  }
}
