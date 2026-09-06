import { useEffect, useRef } from 'react'
import type { CameraTransform } from '@shared/camera'

export default function CameraStage({
  stream,
  transform,
  onError,
  onDimensions
}: {
  stream: MediaStream | null
  transform: CameraTransform
  onDimensions?: (width: number, height: number) => void
  onError?: (error: Error) => void
}): React.JSX.Element {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element) return
    let active = true
    element.srcObject = stream
    if (stream)
      void element.play().catch((error: Error) => {
        if (active) onError?.(error)
      })
    return () => {
      active = false
      element.srcObject = null
    }
  }, [stream, onError])
  return (
    <div
      data-testid="camera-stage"
      className="absolute inset-0 overflow-hidden bg-black"
      data-frame={JSON.stringify(transform)}
    >
      <video
        ref={video}
        onResize={(event) =>
          onDimensions?.(event.currentTarget.videoWidth, event.currentTarget.videoHeight)
        }
        autoPlay
        muted
        playsInline
        className="absolute max-w-none"
        style={{
          left: `${(transform.x / 1920) * 100}%`,
          top: `${(transform.y / 1080) * 100}%`,
          width: `${(transform.width / 1920) * 100}%`,
          height: `${(transform.height / 1080) * 100}%`
        }}
      />
    </div>
  )
}
