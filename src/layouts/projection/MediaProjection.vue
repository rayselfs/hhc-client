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
        <iframe
          v-else-if="currentItem.metadata.fileType === 'pdf'"
          :src="pdfUrl"
          class="media-content w-100 h-100"
          :style="imageStyle"
          frameborder="0"
        ></iframe>

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
import { MessageType } from '@/types/common'
import { throttle } from '@/utils/performanceUtils'

// Access local store (synced via IPC)
const store = useMediaProjectionStore()
const { currentItem, zoomLevel, pan, isPlaying, volume, pdfPage, currentTime, isSeeking } =
  storeToRefs(store)

const videoRef = ref<HTMLVideoElement | null>(null)
const { sendToMain } = useElectron()

// Throttled time reporter - sends projection's actual time to main window (every 1 second)
const reportTimeToMain = throttle((time: number) => {
  sendToMain({
    type: MessageType.MEDIA_CONTROL,
    data: {
      type: 'video',
      action: 'projection-time',
      value: time,
    },
  })
}, 1000)

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
  transform: `translate(${pan.value.x * 100}%, ${pan.value.y * 100}%) scale(${zoomLevel.value})`,
  transition: 'transform 0.2s ease-out',
  maxWidth: '100%',
  maxHeight: '100%',
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
}))

const videoStyle = computed(() => ({
  maxWidth: '100%',
  maxHeight: '100%',
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
}))

// PDF handling
const pdfUrl = computed(() => {
  if (!currentItem.value) return ''
  // Use #page=N to control PDF page if browser supports it
  return `${currentItem.value.url}#page=${pdfPage.value}&toolbar=0&navpanes=0&scrollbar=0`
})

// Video Control with Video.js
watch(isPlaying, (playing) => {
  if (currentItem.value?.metadata.fileType === 'video') {
    if (playing) {
      playPresenterVideo()
    } else {
      pausePresenterVideo()
    }
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
  // 1. During active seeking (user dragging timeline)
  // 2. When paused (user is scrubbing/frame-stepping)
  if (isSeeking.value || !isPlaying.value) {
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

// Watch currentItem changes to reinitialize player
watch(
  currentItem,
  (newItem, oldItem) => {
    // Cleanup old video player
    if (oldItem?.metadata.fileType === 'video') {
      disposePresenterPlayer()
    }

    // Initialize new video player if current item is a video
    if (newItem?.metadata.fileType === 'video' && videoRef.value) {
      nextTick(() => {
        if (videoRef.value && newItem.url) {
          initializePresenterPlayer()
          videoRef.value.src = newItem.url
          // Sync play state after source is set
          if (isPlaying.value) {
            videoRef.value.addEventListener('canplay', () => playPresenterVideo(), { once: true })
          }
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
      if (videoRef.value && currentItem.value?.url) {
        initializePresenterPlayer()
        videoRef.value.src = currentItem.value.url
        // If should be playing, play it
        if (isPlaying.value) {
          videoRef.value.addEventListener('canplay', () => playPresenterVideo(), { once: true })
        }
      }
    })
  }
})

onUnmounted(() => {
  store.setPlaylist([], -1)
  store.exit() // Clear presenting state
  // Cleanup video player
  disposePresenterPlayer()
})
const { onProjectionMessage: onIpcMessage } = useElectron()

onIpcMessage((msg) => {
  if (msg.type !== MessageType.MEDIA_CONTROL || msg.data?.type !== 'video') return

  const action = msg.data.action
  const value = msg.data.value

  switch (action) {
    case 'seek':
      // Explicit seek command - FORCE seek regardless of playing state
      if (typeof value === 'number') {
        seekPresenterVideo(value)
      }
      break
    case 'play':
      playPresenterVideo()
      break
    case 'pause':
      pausePresenterVideo()
      break
    case 'seeking-start':
      // Optional: Prepare for seek
      break
    case 'seeking-end':
      // Explicit seek end command
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
