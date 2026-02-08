import { ref, onUnmounted, type Ref } from 'vue'
import { useSentry } from '@/composables/useSentry'

/**
 * WeakMap to track HTMLMediaElements that have been connected to AudioContext.
 * MediaElementSourceNode can only be created once per element, so we need to track this.
 */
const connectedElements = new WeakMap<
  HTMLMediaElement,
  { audioContext: AudioContext; sourceNode: MediaElementAudioSourceNode; gainNode: GainNode }
>()

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
  const audioContext = ref<AudioContext | null>(null)
  const gainNode = ref<GainNode | null>(null)

  // -- Event Handlers --
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
    // Resume AudioContext if suspended (browser policy)
    if (audioContext.value?.state === 'suspended') {
      audioContext.value.resume()
    }
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

  /**
   * Initialize Native HTML5 player
   */
  const initialize = () => {
    if (!videoRef.value || isInitialized.value) return

    try {
      const el = videoRef.value

      // Setup Attributes
      el.muted = isMuted
      el.playsInline = true
      // el.controls = false // We implement custom controls

      // Attach Event Listeners
      el.addEventListener('timeupdate', handleTimeUpdate)
      el.addEventListener('loadedmetadata', handleLoadedMetadata)
      el.addEventListener('ended', handleEnded)
      el.addEventListener('play', handlePlay)
      el.addEventListener('pause', handlePause)
      el.addEventListener('volumechange', handleVolumeChange)
      el.addEventListener('error', handleError)
      el.addEventListener('waiting', handleWaiting)
      el.addEventListener('canplay', handleCanPlay)

      // Setup Silent Mode (AudioContext) if requested
      if (silent) {
        setupSilentMode()
      }

      isInitialized.value = true
    } catch (error) {
      reportError(error, {
        operation: 'initialize-native-video-player',
        component: 'useVideoPlayer',
      })
    }
  }

  /**
   * Setup AudioContext to mute output while keeping player volume/state active
   * Uses a WeakMap to track already-connected elements (MediaElementSourceNode can only be created once)
   */
  const setupSilentMode = () => {
    if (!videoRef.value) return

    try {
      const el = videoRef.value

      // Check if this element was already connected to an AudioContext
      const existing = connectedElements.get(el)
      if (existing) {
        // Reuse existing audio nodes - just ensure gain is muted
        audioContext.value = existing.audioContext
        gainNode.value = existing.gainNode
        gainNode.value.gain.value = 0

        // Resume if suspended
        if (audioContext.value.state === 'suspended') {
          audioContext.value.resume()
        }
        return
      }

      // Create new AudioContext and connect
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return

      audioContext.value = new AudioContextClass()
      const sourceNode = audioContext.value.createMediaElementSource(el)
      gainNode.value = audioContext.value.createGain()

      // Mute the gain node
      gainNode.value.gain.value = 0

      // Connect source -> gain (muted) -> destination
      sourceNode.connect(gainNode.value)
      gainNode.value.connect(audioContext.value.destination)

      // Store in WeakMap for future reuse
      connectedElements.set(el, {
        audioContext: audioContext.value,
        sourceNode,
        gainNode: gainNode.value,
      })
    } catch (e) {
      // Often fails if element not connected or already connected.
      // Warn but don't crash
      console.warn('Failed to setup AudioContext for silent mode', e)
    }
  }

  /**
   * Dispose player and cleanup resources
   */
  const dispose = () => {
    if (videoRef.value) {
      const el = videoRef.value
      // Remove Listeners
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('loadedmetadata', handleLoadedMetadata)
      el.removeEventListener('ended', handleEnded)
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('pause', handlePause)
      el.removeEventListener('volumechange', handleVolumeChange)
      el.removeEventListener('error', handleError)
      el.removeEventListener('waiting', handleWaiting)
      el.removeEventListener('canplay', handleCanPlay)

      // Stop playback and unload
      el.pause()
      el.removeAttribute('src')
      el.load()
    }

    isInitialized.value = false

    // Note: We do NOT close the AudioContext here because:
    // 1. MediaElementSourceNode can only be created once per element
    // 2. The AudioContext is stored in WeakMap and may be reused
    // 3. AudioContext will be garbage collected when the element is removed
    // Just clear our local refs
    audioContext.value = null
    gainNode.value = null
  }

  /**
   * Play the video
   */
  const play = async () => {
    if (videoRef.value) {
      try {
        await videoRef.value.play()
      } catch (error) {
        // Ignore AbortError which happens when play is interrupted by pause (user clicked fast)
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        reportError(error, {
          operation: 'play-video',
          component: 'useVideoPlayer',
        })
      }
    }
  }

  /**
   * Pause the video
   */
  const pause = () => {
    if (videoRef.value) {
      videoRef.value.pause()
    }
  }

  /**
   * Seek to a specific time in the video
   * @param time Time in seconds
   */
  const seek = (time: number) => {
    if (videoRef.value && typeof time === 'number' && !isNaN(time)) {
      videoRef.value.currentTime = time
    }
  }

  /**
   * Set volume level
   * @param volume Volume level (0-1)
   */
  const setVolume = (volume: number) => {
    if (videoRef.value) {
      videoRef.value.volume = Math.max(0, Math.min(1, volume))
      if (volume > 0) {
        videoRef.value.muted = false
      }
    }
  }

  /**
   * Stop the video (reset to beginning and pause)
   */
  const stop = () => {
    if (videoRef.value) {
      videoRef.value.pause()
      videoRef.value.currentTime = 0
    }
  }

  /**
   * Get current time
   */
  const getCurrentTime = (): number => {
    return videoRef.value?.currentTime || 0
  }

  /**
   * Get duration
   */
  const getDuration = (): number => {
    return videoRef.value?.duration || 0
  }

  /**
   * Get current volume
   */
  const getVolume = (): number => {
    return videoRef.value?.volume ?? 1
  }

  /**
   * Check if video is paused
   */
  const isPaused = (): boolean => {
    return videoRef.value?.paused ?? true
  }

  // Cleanup on component unmount
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
