import type { FileItemRecord } from '@shared/types/folder'

export type MediaProjectionPreflight = (
  items: readonly FileItemRecord[]
) => boolean | Promise<boolean>

let preflight: MediaProjectionPreflight | null = null

export function registerMediaProjectionPreflight(next: MediaProjectionPreflight): () => void {
  preflight = next
  return () => {
    if (preflight === next) preflight = null
  }
}

export function prepareMediaProjection(
  items: readonly FileItemRecord[]
): boolean | Promise<boolean> {
  return preflight?.(items) ?? true
}
