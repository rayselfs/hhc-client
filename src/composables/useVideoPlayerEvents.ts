import type { Ref } from 'vue'

export interface VideoPlayerCallbacks {
  onTimeUpdate?: (time: number) => void
  onDurationChange?: (duration: number) => void
  onEnded?: () => void
  onPlayStateChange?: (isPlaying: boolean) => void
  onVolumeChange?: (volume: number) => void
  onError?: (error: MediaError | null) => void
  onWaiting?: () => void
  onCanPlay?: () => void
}

export function useVideoPlayerEvents(
  videoRef: Ref<HTMLVideoElement | null>,
  callbacks: VideoPlayerCallbacks,
  resumeSilentMode?: () => void,
) {
  const {
    onTimeUpdate,
    onDurationChange,
    onEnded,
    onPlayStateChange,
    onVolumeChange,
    onError,
    onWaiting,
    onCanPlay,
  } = callbacks

  const handleTimeUpdate = () => {
    if (videoRef.value && onTimeUpdate) {
      onTimeUpdate(videoRef.value.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.value && onDurationChange) {
      onDurationChange(videoRef.value.duration)
    }
  }

  const handleEnded = () => {
    if (onEnded) onEnded()
  }

  const handlePlay = () => {
    if (onPlayStateChange) onPlayStateChange(true)
    if (resumeSilentMode) resumeSilentMode()
  }

  const handlePause = () => {
    if (onPlayStateChange) onPlayStateChange(false)
  }

  const handleVolumeChange = () => {
    if (videoRef.value && onVolumeChange) {
      const vol = videoRef.value.volume
      const muted = videoRef.value.muted
      const effectiveVolume = muted ? 0 : vol
      onVolumeChange(effectiveVolume)
    }
  }

  const handleError = () => {
    if (videoRef.value && onError) {
      onError(videoRef.value.error)
    }
  }

  const handleWaiting = () => {
    if (onWaiting) onWaiting()
  }

  const handleCanPlay = () => {
    if (onCanPlay) onCanPlay()
  }

  const attachListeners = (element: HTMLVideoElement) => {
    element.addEventListener('timeupdate', handleTimeUpdate)
    element.addEventListener('loadedmetadata', handleLoadedMetadata)
    element.addEventListener('ended', handleEnded)
    element.addEventListener('play', handlePlay)
    element.addEventListener('pause', handlePause)
    element.addEventListener('volumechange', handleVolumeChange)
    element.addEventListener('error', handleError)
    element.addEventListener('waiting', handleWaiting)
    element.addEventListener('canplay', handleCanPlay)
  }

  const removeListeners = (element: HTMLVideoElement) => {
    element.removeEventListener('timeupdate', handleTimeUpdate)
    element.removeEventListener('loadedmetadata', handleLoadedMetadata)
    element.removeEventListener('ended', handleEnded)
    element.removeEventListener('play', handlePlay)
    element.removeEventListener('pause', handlePause)
    element.removeEventListener('volumechange', handleVolumeChange)
    element.removeEventListener('error', handleError)
    element.removeEventListener('waiting', handleWaiting)
    element.removeEventListener('canplay', handleCanPlay)
  }

  return {
    attachListeners,
    removeListeners,
  }
}
