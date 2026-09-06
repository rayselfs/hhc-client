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
export function resizeCamera(
  frame: CameraTransform,
  corner: 'nw' | 'ne' | 'sw' | 'se',
  width: number,
  coverWidth: number
): CameraTransform {
  const w = Math.min(coverWidth * 8, Math.max(coverWidth * 0.05, width))
  const h = (w * frame.height) / frame.width
  return {
    x: corner.endsWith('w') ? frame.x + frame.width - w : frame.x,
    y: corner.startsWith('n') ? frame.y + frame.height - h : frame.y,
    width: w,
    height: h
  }
}
