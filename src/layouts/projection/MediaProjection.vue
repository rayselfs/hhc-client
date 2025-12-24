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

        <!-- Video -->
        <video
          v-else-if="currentItem.metadata.fileType === 'video'"
          ref="videoRef"
          :src="currentItem.url"
          class="media-content"
          :style="videoStyle"
          :volume="volume"
          @ended="onVideoEnded"
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
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { storeToRefs } from 'pinia'

// Access local store (synced via IPC)
const store = useMediaProjectionStore()
const { currentItem, zoomLevel, pan, isPlaying, volume, pdfPage } = storeToRefs(store)

const videoRef = ref<HTMLVideoElement | null>(null)

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

// Video Control
watch(isPlaying, (playing) => {
  if (videoRef.value) {
    if (playing) videoRef.value.play().catch((e) => console.error('Play failed', e))
    else videoRef.value.pause()
  }
})

// Restart Trigger Watcher
const { restartTrigger } = storeToRefs(store)
watch(restartTrigger, () => {
  if (videoRef.value) {
    videoRef.value.currentTime = 0
    videoRef.value.pause()
  }
})

onMounted(() => {
  // Initial sync
  if (videoRef.value && isPlaying.value) {
    videoRef.value.play().catch(() => {})
  }
})

onUnmounted(() => {
  store.setPlaylist([], -1)
  store.exit() // Clear presenting state
})

// User Request 1: Video Finished -> Ready
import { useElectron } from '@/composables/useElectron'
import { MessageType } from '@/types/common'

const { sendToMain } = useElectron()

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
