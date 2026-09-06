import type { CameraTransform } from '@shared/camera'
export const CAMERA_STAGE = { width: 1920, height: 1080 } as const
export function createCameraCover(width: number, height: number): CameraTransform {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Invalid camera dimensions')
  const scale = Math.max(1920 / width, 1080 / height)
  return {
    x: (1920 - width * scale) / 2,
    y: (1080 - height * scale) / 2,
    width: width * scale,
    height: height * scale
  }
}
export type CameraHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export function resizeCamera(
  frame: CameraTransform,
  corner: CameraHandle,
  width: number,
  coverWidth: number
): CameraTransform {
  const w = Math.min(coverWidth * 8, Math.max(coverWidth * 0.05, width))
  const h = (w * frame.height) / frame.width
  return {
    x: corner.includes('w')
      ? frame.x + frame.width - w
      : corner.includes('e')
        ? frame.x
        : frame.x + (frame.width - w) / 2,
    y: corner.includes('n')
      ? frame.y + frame.height - h
      : corner.includes('s')
        ? frame.y
        : frame.y + (frame.height - h) / 2,
    width: w,
    height: h
  }
}
