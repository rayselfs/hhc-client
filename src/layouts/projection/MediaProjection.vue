<template>
  <div class="media-projection fill-height d-flex align-center justify-center">
    <!-- 16:9 Container -->
    <div
      class="aspect-container position-relative d-flex align-center justify-center overflow-hidden"
      style="aspect-ratio: 16/9; max-width: 100%; max-height: 100%; width: 100%"
    >
      <template v-if="currentItem">
        <!-- Image -->
        <img
          v-if="currentItem.metadata.fileType === 'image'"
          :src="currentItem.url"
          class="media-content"
          :style="imageStyle"
          alt="projection"
        />

        <!-- Video with Native Video -->
        <video
          v-else-if="currentItem.metadata.fileType === 'video'"
          ref="videoRef"
          class="media-content"
          :style="videoStyle"
        ></video>

        <!-- PDF -->
        <PdfViewer
          v-else-if="currentItem.metadata.fileType === 'pdf'"
          :url="currentItem.url"
          :page="pdfPage"
          :view-mode="pdfViewMode"
          :zoom="zoomLevel"
          :pan="pan"
          class="w-100 h-100"
        />

        <!-- Fallback or Unsupported -->
        <div v-else class="text-h4 text-white">
          Unsupported Media Type: {{ currentItem.metadata.fileType }}
        </div>
      </template>

      <div v-else class="text-h4 text-grey">
        <!-- Empty State -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { storeToRefs } from 'pinia'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import { useElectron } from '@/composables/useElectron'
import { MessageType } from '@/types/projection'
import { throttle } from '@/utils/performanceUtils'
import { needsTranscode, buildVideoUrl } from '@/utils/videoUtils'
import PdfViewer from '@/components/Media/PdfViewer.vue'

// Access local store (synced via IPC)
const store = useMediaProjectionStore()
const {
  currentItem,
  zoomLevel,
  pan,
  isPlaying,
  volume,
  pdfPage,
  pdfViewMode,
  currentTime,
  isSeeking,
} = storeToRefs(store)

const videoRef = ref<HTMLVideoElement | null>(null)
const { sendToMain } = useElectron()

// Throttled time reporter - sends projection's actual time to main window (every 500ms for smoother sync)
const reportTimeToMain = throttle((time: number) => {
  sendToMain({
    type: MessageType.MEDIA_CONTROL,
    data: {
      type: 'video',
      action: 'projection-time',
      value: time,
    },
  })
}, 500)

const onVideoEnded = () => {
  // Notify Main Window (Presenter) that video finished
  sendToMain({
    type: MessageType.MEDIA_CONTROL,
    data: {
      type: 'video',
      action: 'ended',
    },
  })
}

// Video Player setup for projection window
const {
  initialize: initializePresenterPlayer,
  dispose: disposePresenterPlayer,
  play: playPresenterVideo,
  pause: pausePresenterVideo,
  seek: seekPresenterVideo,
  setVolume: setPresenterVolume,
} = useVideoPlayer({
  videoRef,
  isMuted: false, // Projection has volume control (plays actual audio)
  onEnded: onVideoEnded,
  onTimeUpdate: (time) => {
    // Report projection's actual time back to main window during playback
    if (isPlaying.value && !isSeeking.value) {
      reportTimeToMain(time)
    }
  },
})

// Styles
const imageStyle = computed(() => ({
  transform: `scale(${zoomLevel.value}) translate(${pan.value.x * 100}%, ${pan.value.y * 100}%)`,
  transition: 'transform 0.2s ease-out',
  maxWidth: '100%',
  maxHeight: '100%',
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
}))

const videoStyle = computed(() => ({
  transform: `scale(${zoomLevel.value}) translate(${pan.value.x * 100}%, ${pan.value.y * 100}%)`,
  transition: 'transform 0.2s ease-out',
  maxWidth: '100%',
  maxHeight: '100%',
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
}))

// Video Control with Video.js
// This watcher responds to store state changes (from IPC message handling)
watch(isPlaying, (playing) => {
  if (currentItem.value?.metadata.fileType !== 'video') return
  if (!videoRef.value || !videoInitialized.value) return

  // Check if current state matches desired state to avoid redundant operations
  const isPaused = videoRef.value.paused
  if (playing && isPaused) {
    playPresenterVideo()
  } else if (!playing && !isPaused) {
    pausePresenterVideo()
  }
})

// Watch volume changes
watch(volume, (vol) => {
  if (currentItem.value?.metadata.fileType === 'video') {
    setPresenterVolume(vol)
  }
})

// Watch currentTime for seeking (from control window)
// Projection is the LEADER - only seek on explicit commands, NOT during normal playback
watch(currentTime, (targetTime) => {
  if (currentItem.value?.metadata.fileType !== 'video') return

  // ONLY seek in these cases:
  // 1. During active seeking (user dragging timeline) - Disabled for transcoded videos in Presenter
  // 2. When paused (user is scrubbing/frame-stepping)
  if (isSeeking.value || !isPlaying.value) {
    // If it's a transcoded video, seek might not be supported/reliable,
    // but native seek call is harmless if not supported or range request fails.
    // However, we disabled UI seeking for transcoded, so this shouldn't fire often
    // except maybe for drift correction or initial load.
    // We keep it generic.
    seekPresenterVideo(targetTime)
  }

  // During normal playback: DO NOTHING
  // Let the projection video play smoothly without interruption
})

// Watch isSeeking state changes to ensure final seek when seeking ends
watch(
  () => store.isSeeking,
  (seeking, wasSeeking) => {
    if (currentItem.value?.metadata.fileType !== 'video') return

    // When seeking ends (true -> false), ensure we seek to the final position
    if (wasSeeking && !seeking) {
      seekPresenterVideo(currentTime.value)
    }
  },
)

// Track video initialization to prevent duplicate FFmpeg streams
const videoInitialized = ref(false)
const lastVideoUrl = ref('')

// Now using shared utilities from @/utils/videoUtils

/**
 * Build video URL
 * Uses shared utility but adds projection-specific window identifier
 */
const buildVideoUrlForProjection = (baseUrl: string): string => {
  const isTranscode = needsTranscode(baseUrl)
  return buildVideoUrl({
    baseUrl,
    isTranscoded: isTranscode,
    window: 'projection',
  })
}

/**
 * Initialize video player with proper cleanup and error handling
 * @param forceReload - Force reload even if same URL (for replay scenario)
 */
const initializeVideoPlayer = (url: string, shouldPlay: boolean, forceReload = false) => {
  if (!videoRef.value || !url) return

  // Build video URL
  const videoSrc = buildVideoUrlForProjection(url)

  // Avoid reinitializing if same URL (prevents FFmpeg restart issues)
  // Unless forceReload is true (for replay scenario)
  if (!forceReload && videoInitialized.value && lastVideoUrl.value === url) {
    return
  }

  // Dispose old player first
  disposePresenterPlayer()

  // Initialize new player
  initializePresenterPlayer()
  videoRef.value.src = videoSrc
  lastVideoUrl.value = url
  videoInitialized.value = true

  // Handle initial play state
  if (shouldPlay) {
    videoRef.value.addEventListener(
      'canplay',
      () => {
        playPresenterVideo()
      },
      { once: true },
    )
  }

  // Handle video errors (e.g., FFmpeg stream interrupted)
  videoRef.value.addEventListener(
    'error',
    (e) => {
      console.error('Projection video error:', e)
      // Mark as not initialized so it can be reinitialized on next attempt
      videoInitialized.value = false
    },
    { once: true },
  )
}

// Watch currentItem changes to reinitialize player
watch(
  currentItem,
  (newItem, oldItem) => {
    // Cleanup old video player
    if (oldItem?.metadata.fileType === 'video') {
      disposePresenterPlayer()
      videoInitialized.value = false
      lastVideoUrl.value = ''
    }

    // Initialize new video player if current item is a video
    if (newItem?.metadata.fileType === 'video') {
      nextTick(() => {
        if (newItem.url) {
          initializeVideoPlayer(newItem.url, isPlaying.value)
        }
      })
    }
  },
  { immediate: false },
)

onMounted(() => {
  // Initialize video player if current item is already a video
  if (currentItem.value?.metadata.fileType === 'video') {
    nextTick(() => {
      if (currentItem.value?.url) {
        initializeVideoPlayer(currentItem.value.url, isPlaying.value)
      }
    })
  }
})

onUnmounted(() => {
  store.setPlaylist([], -1)
  store.exit() // Clear presenting state
  // Cleanup video player and reset tracking state
  disposePresenterPlayer()
  videoInitialized.value = false
  lastVideoUrl.value = ''
})
const { onProjectionMessage: onIpcMessage } = useElectron()

onIpcMessage((msg) => {
  if (msg.type !== MessageType.MEDIA_CONTROL || msg.data?.type !== 'video') return

  const action = msg.data.action
  const value = msg.data.value

  // Skip other actions if video not initialized (prevents errors during initialization)
  if (!videoInitialized.value || !videoRef.value) return

  switch (action) {
    case 'seek':
      // Explicit seek command - FORCE seek regardless of playing state
      // For native videos (MP4, WebM) only
      if (typeof value === 'number') {
        // If seeking to 0 on a transcoded video, we need to reload the stream
        if (value === 0 && currentItem.value?.url && needsTranscode(currentItem.value.url)) {
          initializeVideoPlayer(currentItem.value.url, isPlaying.value, true)
        } else {
          seekPresenterVideo(value)
        }
      }
      break
    case 'play':
      // Only play if currently paused (avoid redundant operations)
      if (videoRef.value.paused) {
        playPresenterVideo()
      }
      break
    case 'pause':
      // Only pause if currently playing
      if (!videoRef.value.paused) {
        pausePresenterVideo()
      }
      break
    case 'seeking-start':
      // Optional: Prepare for seek
      break
    case 'seeking-end':
      // Explicit seek end command (for native videos)
      if (typeof value === 'number') {
        seekPresenterVideo(value)
      }
      break
  }
})
</script>

<style scoped>
.media-projection {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.media-content {
  display: block;
}
</style>
