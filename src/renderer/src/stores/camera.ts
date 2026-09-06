import { create } from 'zustand'
import type { CameraTransform } from '@shared/camera'

interface CameraStore {
  devices: Array<{ id: string; label: string }>
  deviceId: string
  transform: CameraTransform
  cover: CameraTransform
  busy: boolean
  error: string | null
  connection: 'idle' | 'connecting' | 'live' | 'unavailable'
  updateTransform(frame: CameraTransform): void
}
const initial = { x: 0, y: 0, width: 1920, height: 1080 }
export const useCameraStore = create<CameraStore>((set) => ({
  devices: [],
  deviceId: '',
  transform: initial,
  cover: initial,
  busy: false,
  error: null,
  connection: 'idle',
  updateTransform: (frame) => {
    if (!Object.values(frame).every(Number.isFinite)) return
    set({
      transform: {
        ...frame,
        x: Math.max(-15360, Math.min(15360, frame.x)),
        y: Math.max(-8640, Math.min(8640, frame.y))
      }
    })
  }
}))
