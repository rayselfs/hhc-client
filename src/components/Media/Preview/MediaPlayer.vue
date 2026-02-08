<template>
  <div
    class="media-player fill-height w-100 d-flex align-center justify-center bg-black position-relative"
  >
    <template v-if="item">
      <img
        v-if="item.metadata.fileType === 'image'"
        :src="item.url"
        class="preview-content"
        style="object-fit: contain"
      />
      <!-- Video Preview -->
      <div
        v-else-if="item.metadata.fileType === 'video'"
        class="fill-height w-100 d-flex align-center justify-center bg-black position-relative"
      >
        <video
          ref="previewVideoRef"
          :key="item.id"
          class="w-100 h-100"
          style="object-fit: contain"
        ></video>

        <!-- Custom Video Controls -->
        <MediaVideoControls
          :is-playing="isPlaying"
          :current-time="store.currentTime"
          :duration="store.duration"
          :volume="volume"
          :is-muted="false"
          :is-ended="isPreviewEnded"
          :disable-seeking="needsTranscodeComputed"
          class="position-absolute bottom-0 left-0 right-0 ma-2"
          style="z-index: 20"
          @play="playPreviewVideo"
          @seek="onSeek"
          @pause="pausePreviewVideo"
          @replay="replayVideo"
          @seeking-start="onSeekingStart"
          @seeking-end="onSeekingEnd"
          @volume-change="setPreviewVolume"
          @toggle-mute="toggleMute"
        />
      </div>
    </template>

    <!-- Viewport Frame Overlay for Image -->
    <div
      v-if="showZoomControls && item?.metadata.fileType === 'image'"
      class="position-absolute border"
      :style="{
        borderColor: '#2196F3 !important',
        borderWidth: '1px !important',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        width: `${minimapViewport.width}%`,
        height: `${minimapViewport.height}%`,
        left: `${minimapViewport.left}%`,
        top: `${minimapViewport.top}%`,
        pointerEvents: 'none',
        zIndex: 10,
      }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { useElectron } from '@/composables/useElectron'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import { MessageType } from '@/types/common'
import type { FileItem } from '@/types/common'
import { needsTranscode, buildVideoUrl } from '@/utils/videoUtils'
import MediaVideoControls from '@/components/Media/Preview/MediaVideoControls.vue'

interface Props {
  item: FileItem | null | undefined
  showZoomControls: boolean
}

const props = defineProps<Props>()

const store = useMediaProjectionStore()
const { isPlaying, volume, zoomLevel, pan } = storeToRefs(store)
const { sendProjectionMessage } = useProjectionManager()
const { onProjectionMessage } = useElectron()

const previewVideoRef = ref<HTMLVideoElement | null>(null)
const isPreviewEnded = ref(false)
const isSeeking = ref(false)

const {
  initialize: initializePreviewPlayer,
  dispose: disposePreviewPlayer,
  play: playPreviewVideo,
  pause: pausePreviewVideo,
  seek: seekPreviewVideo,
  setVolume: setPreviewVolume,
} = useVideoPlayer({
  videoRef: previewVideoRef,
  isMuted: false,
  silent: true,
  onTimeUpdate: (time) => {
    if (!isSeeking.value) {
      store.setCurrentTime(time)
    }
  },
  onDurationChange: (dur) => {
    const metadataDuration = props.item?.metadata?.duration
    const effectiveDuration = metadataDuration && metadataDuration > 0 ? metadataDuration : dur

    store.setDuration(effectiveDuration)
    sendProjectionMessage(MessageType.MEDIA_CONTROL, {
      type: 'video',
      action: 'durationchange',
      value: effectiveDuration,
    })
  },
  onVolumeChange: (vol) => {
    store.setVolume(vol)
  },
  onEnded: () => {
    store.setPlaying(false)
    isPreviewEnded.value = true
  },
  onPlayStateChange: (playing) => {
    store.setPlaying(playing)
    if (playing) {
      isPreviewEnded.value = false
    }
  },
})

const needsTranscodeComputed = computed(() => {
  const url = props.item?.url
  if (!url) return false
  return needsTranscode(url)
})

const buildVideoUrlForPreview = (baseUrl: string): string => {
  return buildVideoUrl({
    baseUrl,
    isTranscoded: needsTranscodeComputed.value,
    window: 'preview',
  })
}

const initializeCurrentVideo = (autoPlay = false) => {
  const item = props.item
  if (!item || item.metadata.fileType !== 'video') return

  isPreviewEnded.value = false

  const metadataDuration =
    item.metadata.duration && item.metadata.duration > 0 ? item.metadata.duration : 0
  if (metadataDuration > 0) {
    store.setDuration(metadataDuration)
    sendProjectionMessage(MessageType.MEDIA_CONTROL, {
      type: 'video',
      action: 'durationchange',
      value: metadataDuration,
    })
  }

  nextTick(() => {
    if (previewVideoRef.value && item.url) {
      disposePreviewPlayer()
      initializePreviewPlayer()
      const videoSrc = buildVideoUrlForPreview(item.url)
      previewVideoRef.value.src = videoSrc

      if (autoPlay) {
        previewVideoRef.value.addEventListener(
          'canplay',
          () => {
            playPreviewVideo()
          },
          { once: true },
        )
      }
    }
  })
}

const onSeek = (time: number) => {
  if (needsTranscodeComputed.value) return
  isSeeking.value = true
  store.setCurrentTime(time)
  seekPreviewVideo(time)
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'seek', value: time },
    { force: true },
  )
}

const replayVideo = () => {
  isPreviewEnded.value = false
  store.setCurrentTime(0)
  store.setPlaying(true)

  if (needsTranscodeComputed.value) {
    initializeCurrentVideo(true)
    sendProjectionMessage(
      MessageType.MEDIA_CONTROL,
      { type: 'video', action: 'seek', value: 0 },
      { force: true },
    )
  } else {
    seekPreviewVideo(0)
    playPreviewVideo()
    sendProjectionMessage(
      MessageType.MEDIA_CONTROL,
      { type: 'video', action: 'seek', value: 0 },
      { force: true },
    )
  }

  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'play' },
    { force: true },
  )
}

const toggleMute = () => {
  setPreviewVolume(volume.value > 0 ? 0 : 1)
}

const onSeekingStart = () => {
  if (needsTranscodeComputed.value) return
  isSeeking.value = true
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'seeking-start' },
    { force: true },
  )
}

const onSeekingEnd = (finalTime: number) => {
  if (needsTranscodeComputed.value) return
  isSeeking.value = true
  store.setCurrentTime(finalTime)
  seekPreviewVideo(finalTime)
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'seeking-end', value: finalTime },
    { force: true },
  )
  setTimeout(() => {
    isSeeking.value = false
  }, 1000)
}

// Minimap Logic
const minimapViewport = computed(() => {
  const zoom = zoomLevel.value
  const centerX = 0.5 - pan.value.x
  const centerY = 0.5 - pan.value.y
  const viewportWidth = 1 / zoom
  const viewportHeight = 1 / zoom
  const left = (centerX - viewportWidth / 2) * 100
  const top = (centerY - viewportHeight / 2) * 100
  return { left, top, width: viewportWidth * 100, height: viewportHeight * 100 }
})

watch(
  () => props.item,
  (newItem, oldItem) => {
    if (oldItem?.metadata.fileType === 'video') {
      disposePreviewPlayer()
    }
    if (newItem?.metadata.fileType === 'video') {
      store.setCurrentTime(0)
      store.setPlaying(false)
      sendProjectionMessage(MessageType.MEDIA_CONTROL, {
        type: 'video',
        action: 'seek',
        value: 0,
      })
      initializeCurrentVideo()
    }
  },
  { immediate: true },
)

watch(isPlaying, (val) => {
  if (props.item?.metadata.fileType === 'video' && previewVideoRef.value) {
    const isPaused = previewVideoRef.value.paused
    if (val && isPaused) {
      playPreviewVideo()
    } else if (!val && !isPaused) {
      pausePreviewVideo()
      previewVideoRef.value.playbackRate = 1.0
    }
  }
  sendProjectionMessage(MessageType.MEDIA_CONTROL, {
    type: 'video',
    action: val ? 'play' : 'pause',
  })
})

watch(volume, (val) => {
  sendProjectionMessage(MessageType.MEDIA_CONTROL, {
    type: 'video',
    action: 'volume',
    value: val,
  })
})

onMounted(() => {
  onProjectionMessage((msg) => {
    if (msg.type === MessageType.MEDIA_CONTROL && msg.data?.type === 'video') {
      if (msg.data?.action === 'ended') {
        store.setPlaying(false)
      } else if (msg.data?.action === 'projection-time') {
        const projectionTime = Number(msg.data.value)
        if (previewVideoRef.value && !isSeeking.value && isPlaying.value) {
          const previewRawTime = previewVideoRef.value.currentTime
          const drift = previewRawTime - projectionTime
          if (Math.abs(drift) > 1.0) {
            seekPreviewVideo(projectionTime)
            previewVideoRef.value.playbackRate = 1.0
          } else if (Math.abs(drift) > 0.1) {
            previewVideoRef.value.playbackRate = drift > 0 ? 0.95 : 1.05
          } else if (previewVideoRef.value.playbackRate !== 1.0) {
            previewVideoRef.value.playbackRate = 1.0
          }
        }
      }
    }
  })

  if (props.item?.metadata.fileType === 'video') {
    initializeCurrentVideo()
  }
})

// Expose methods for keyboard shortcuts
defineExpose({
  togglePlay: () => {
    if (props.item?.metadata.fileType !== 'video') return
    if (isPreviewEnded.value) {
      replayVideo()
    } else if (isPlaying.value) {
      pausePreviewVideo()
    } else {
      playPreviewVideo()
    }
  },
})
</script>

<style scoped>
.preview-content {
  max-width: 100%;
  max-height: 100%;
}
</style>
