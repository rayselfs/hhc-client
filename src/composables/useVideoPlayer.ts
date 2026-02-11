import { ref, onUnmounted, type Ref } from 'vue'
import { useSentry } from '@/composables/useSentry'
import { useVideoSilentMode } from '@/composables/useVideoSilentMode'
import { useVideoPlayerEvents, type VideoPlayerCallbacks } from '@/composables/useVideoPlayerEvents'

export interface VideoPlayerOptions {
  /**
   * Ref to the video HTML element
   */
  videoRef: Ref<HTMLVideoElement | null>

  /**
   * Whether the video should be muted
   */
  isMuted: boolean

  /**
   * Whether to show Video.js controls
   * @default true
   * @deprecated Not used in native player
   */
  showControls?: boolean

  /**
   * Callback when current time updates
   */
  onTimeUpdate?: (time: number) => void

  /**
   * Callback when duration changes (video metadata loaded)
   */
  onDurationChange?: (duration: number) => void

  /**
   * Callback when video playback ends
   */
  onEnded?: () => void

  /**
   * Callback when play state changes
   */
  onPlayStateChange?: (isPlaying: boolean) => void

  /**
   * Video.js Control Bar Options
   * @deprecated Not used in native player
   */
  controlBar?: boolean | Record<string, unknown>

  /**
   * Whether to force silence using AudioContext (Video.js thinks volume is up, but no sound output)
   * Useful for preview windows where you want to see the volume bar but not hear audio.
   */
  silent?: boolean

  /**
   * Callback when volume changes
   */
  onVolumeChange?: (volume: number) => void

  /**
   * Callback when video encounters an error
   * Useful for handling stream interruptions (e.g., FFmpeg process terminated)
   */
  onError?: (error: MediaError | null) => void

  /**
   * Callback when video stalls (waiting for data)
   * Useful for showing loading indicators during transcoding
   */
  onWaiting?: () => void

  /**
   * Callback when video can continue playing after stalling
   */
  onCanPlay?: () => void
}

/**
 * Composable for managing Native HTML5 video player lifecycle and events
 */
export function useVideoPlayer(options: VideoPlayerOptions) {
  const {
    videoRef,
    isMuted,
    silent = false,
    onTimeUpdate,
    onDurationChange,
    onEnded,
    onPlayStateChange,
    onVolumeChange,
    onError,
    onWaiting,
    onCanPlay,
  } = options

  const { reportError } = useSentry()
  const isInitialized = ref(false)
  const silentMode = silent ? useVideoSilentMode(videoRef) : null

  const callbacks: VideoPlayerCallbacks = {
    onTimeUpdate,
    onDurationChange,
    onEnded,
    onPlayStateChange,
    onVolumeChange,
    onError,
    onWaiting,
    onCanPlay,
  }

  const { attachListeners, removeListeners } = useVideoPlayerEvents(
    videoRef,
    callbacks,
    silentMode?.resume,
  )

  /**
   * Initialize Native HTML5 player
   */
  const initialize = () => {
    if (!videoRef.value || isInitialized.value) return

    try {
      const el = videoRef.value

      el.muted = isMuted
      el.playsInline = true

      attachListeners(el)
      if (silentMode) silentMode.setup()

      isInitialized.value = true
    } catch (error) {
      reportError(error, {
        operation: 'initialize-native-video-player',
        component: 'useVideoPlayer',
      })
    }
  }

  /**
   * Dispose player and cleanup resources
   */
  const dispose = () => {
    if (videoRef.value) {
      const el = videoRef.value
      removeListeners(el)
      el.pause()
      el.removeAttribute('src')
      el.load()
    }

    isInitialized.value = false
    if (silentMode) silentMode.cleanup()
  }

  const play = async () => {
    if (videoRef.value) {
      try {
        await videoRef.value.play()
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        reportError(error, { operation: 'play-video', component: 'useVideoPlayer' })
      }
    }
  }

  const pause = () => {
    if (videoRef.value) videoRef.value.pause()
  }

  const seek = (time: number) => {
    if (videoRef.value && typeof time === 'number' && !isNaN(time)) {
      videoRef.value.currentTime = time
    }
  }

  const setVolume = (volume: number) => {
    if (videoRef.value) {
      videoRef.value.volume = Math.max(0, Math.min(1, volume))
      if (volume > 0) videoRef.value.muted = false
    }
  }

  const stop = () => {
    if (videoRef.value) {
      videoRef.value.pause()
      videoRef.value.currentTime = 0
    }
  }

  const getCurrentTime = (): number => videoRef.value?.currentTime || 0
  const getDuration = (): number => videoRef.value?.duration || 0
  const getVolume = (): number => videoRef.value?.volume ?? 1
  const isPaused = (): boolean => videoRef.value?.paused ?? true

  onUnmounted(() => {
    dispose()
  })

  return {
    isInitialized,
    initialize,
    dispose,
    play,
    pause,
    seek,
    setVolume,
    stop,
    getCurrentTime,
    getDuration,
    getVolume,
    isPaused,
  }
}
