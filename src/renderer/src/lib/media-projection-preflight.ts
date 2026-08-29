import type { FileItemRecord } from '@shared/types/folder'

export type MediaProjectionPreflightResult =
  | { status: 'ready'; validate?: () => boolean }
  | { status: 'blocked' }

export type MediaProjectionPreflight = (
  items: readonly FileItemRecord[]
) => boolean | MediaProjectionPreflightResult | Promise<boolean | MediaProjectionPreflightResult>

let preflight: MediaProjectionPreflight | null = null

export function registerMediaProjectionPreflight(next: MediaProjectionPreflight): () => void {
  preflight = next
  return () => {
    if (preflight === next) preflight = null
  }
}

export function prepareMediaProjection(
  items: readonly FileItemRecord[]
): boolean | MediaProjectionPreflightResult | Promise<boolean | MediaProjectionPreflightResult> {
  return preflight?.(items) ?? true
}

export function resetMediaProjectionPreflightForTests(): void {
  preflight = null
}
