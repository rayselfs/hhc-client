<template>
  <div class="media-presenter fill-height d-flex flex-column bg-black">
    <!-- Main Content Area with Vuetify Grid -->
    <v-container v-if="!showGrid" fluid class="flex-grow-1 overflow-hidden pa-0">
      <v-row no-gutters class="fill-height">
        <!-- Left Column: Main Preview & Controls (cols=8) -->
        <v-col cols="8" class="d-flex flex-column pa-4 border-e">
          <!-- Live Preview -->
          <div :style="{ height: `${leftCardHeight - 48 - 16}px` }">
            <div class="d-flex align-center mb-2">
              <v-btn variant="text" icon @click="exitPresentation">
                <v-icon>mdi-close</v-icon>
              </v-btn>
              <div class="text-h6 font-weight-bold">
                {{ stopwatchStore.formattedLocalTime }}
              </div>
            </div>

            <!-- Preview -->
            <div
              class="live-preview-container bg-black mb-4 rounded relative d-flex align-center justify-center position-relative"
              :style="{
                aspectRatio: '16/9',
                width: '100%',
                overflow: 'hidden',
                cursor: cursorStyle,
              }"
              ref="previewContainer"
              @mousedown="startPanDrag"
            >
              <template v-if="currentItem">
                <img
                  v-if="currentItem.metadata.fileType === 'image'"
                  :src="currentItem.url"
                  class="preview-content"
                  style="object-fit: contain"
                />
                <!-- Video Preview -->
                <div
                  v-else-if="currentItem.metadata.fileType === 'video'"
                  class="fill-height w-100 d-flex align-center justify-center bg-black"
                >
                  <video
                    ref="previewVideoRef"
                    :key="currentItem.id"
                    class="w-100 h-100"
                    style="object-fit: contain"
                  ></video>
                </div>
                <!-- PDF Preview -->
                <div
                  v-else-if="currentItem.metadata.fileType === 'pdf'"
                  class="text-center position-relative w-100 h-100 d-flex align-center justify-center"
                >
                  <iframe
                    :src="pdfUrl"
                    class="media-content fill-height w-100"
                    frameborder="0"
                  ></iframe>

                  <v-btn
                    class="position-absolute left-0 ma-2"
                    icon="mdi-chevron-left"
                    variant="text"
                    color="black"
                    @click="prevPdfPage"
                    style="z-index: 5; background: rgba(255, 255, 255, 0.5)"
                  ></v-btn>

                  <div
                    class="position-absolute bottom-0 mb-4 bg-black rounded px-2 py-1"
                    style="z-index: 5; opacity: 0.8"
                  >
                    <div class="text-subtitle-2 text-white">
                      {{ $t('media.page') }} {{ pdfPage }}
                    </div>
                  </div>

                  <v-btn
                    class="position-absolute right-0 ma-2"
                    icon="mdi-chevron-right"
                    variant="text"
                    color="black"
                    @click="nextPdfPage"
                    style="z-index: 5; background: rgba(255, 255, 255, 0.5)"
                  ></v-btn>
                </div>
              </template>

              <!-- Viewport Frame Overlay (Always visible when zoomed) -->
              <div
                v-if="
                  (currentItem?.metadata.fileType === 'image' ||
                    currentItem?.metadata.fileType === 'pdf') &&
                  zoomLevel > 1
                "
                class="position-absolute border"
                :style="{
                  borderColor: '#2196F3 !important',
                  borderWidth: '2px !important',
                  backgroundColor: 'rgba(33, 150, 243, 0.2)',
                  width: `${minimapViewport.width}%`,
                  height: `${minimapViewport.height}%`,
                  left: `${minimapViewport.left}%`,
                  top: `${minimapViewport.top}%`,
                  pointerEvents: 'none',
                  zIndex: 10,
                }"
              ></div>

              <!-- Drag Overlay for PDF (To capture mouse events over iframe) -->
              <div
                v-if="currentItem?.metadata.fileType === 'pdf' && showZoomControls"
                class="position-absolute w-100 h-100 top-0 left-0"
                style="z-index: 5; cursor: grab"
                @mousedown="startPanDrag"
              ></div>

              <!-- Zoom Controls Only -->
              <v-fade-transition>
                <div
                  v-if="
                    (showZoomControls &&
                      (currentItem?.metadata.fileType === 'image' ||
                        currentItem?.metadata.fileType === 'pdf')) ||
                    ((currentItem?.metadata.fileType === 'image' ||
                      currentItem?.metadata.fileType === 'pdf') &&
                      zoomLevel > 1)
                  "
                  class="position-absolute bottom-0 right-0 ma-4 rounded pa-2 d-flex flex-column align-center elevation-4 bg-surface"
                  style="z-index: 10"
                  @mousedown.stop
                >
                  <div class="d-flex align-center gap-2">
                    <v-btn size="x-small" icon="mdi-minus" @click.stop="zoomOut"></v-btn>
                    <span class="text-caption" style="min-width: 40px; text-align: center"
                      >{{ Math.round(zoomLevel * 100) }}%</span
                    >
                    <v-btn size="x-small" icon="mdi-plus" @click.stop="zoomIn"></v-btn>
                  </div>
                </div>
              </v-fade-transition>
              <!-- Custom Video Controls -->
              <MediaVideoControls
                v-if="currentItem?.metadata.fileType === 'video'"
                :is-playing="isPlaying"
                :current-time="store.currentTime"
                :duration="store.duration"
                :volume="volume"
                :is-muted="false"
                :is-ended="isPreviewEnded"
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

            <!-- Control Bar (Under Preview) -->
            <div class="d-flex justify-start align-center gap-4 py-2">
              <!-- 1. Grid View -->
              <v-btn
                variant="text"
                icon
                size="large"
                @click="store.toggleGrid()"
                :title="$t('media.slideNavigator')"
              >
                <v-icon size="32">mdi-view-grid</v-icon>
              </v-btn>

              <!-- 2. Zoom (Image/PDF) -->
              <v-btn
                variant="text"
                icon
                size="large"
                @click="toggleZoom()"
                :disabled="
                  !currentItem ||
                  (currentItem.metadata.fileType !== 'image' &&
                    currentItem.metadata.fileType !== 'pdf')
                "
                :color="showZoomControls ? 'primary' : ''"
                :title="$t('media.zoom')"
              >
                <v-icon size="32">mdi-magnify</v-icon>
              </v-btn>
            </div>
          </div>

          <!-- Navigation & Progress -->
          <div class="pb-4 d-flex align-center justify-center gap-4 mt-auto">
            <!-- Prev Button -->
            <v-btn
              icon="mdi-chevron-left"
              variant="outlined"
              class="rounded-circle mr-3"
              @click="store.prev()"
              :disabled="currentIndex <= 0"
            ></v-btn>
            <!-- Center: Text & Progress -->
            <div class="d-flex flex-column align-center flex-grow-1 mr-3" style="max-width: 200px">
              <div class="text-subtitle-1 font-weight-bold mb-1">
                {{ $t('media.slide') }} {{ currentIndex + 1 }} ({{ $t('media.total') }}
                {{ playlist.length }} {{ $t('media.slides') }})
              </div>
              <v-progress-linear
                :model-value="((currentIndex + 1) / playlist.length) * 100"
                height="6"
                rounded
                color="white"
                class="w-100"
              ></v-progress-linear>
            </div>

            <!-- Next Button -->
            <v-btn
              icon="mdi-chevron-right"
              variant="outlined"
              class="rounded-circle"
              @click="store.next()"
              :disabled="currentIndex >= playlist.length - 1"
            ></v-btn>
          </div>
        </v-col>

        <!-- Right Column: Next Slide & Notes (cols=4) -->
        <v-col cols="4" class="d-flex flex-column pa-4">
          <!-- Next Slide -->
          <div class="d-flex flex-column border-b">
            <div class="text-subtitle-1 mb-2 text-grey">{{ $t('media.nextSlide') }}</div>
            <div
              class="next-preview bg-black rounded mb-4 d-flex align-center justify-center"
              style="aspect-ratio: 16/9; width: 100%; height: auto"
            >
              <template v-if="nextItem">
                <img
                  v-if="nextItem.metadata.fileType === 'image'"
                  :src="nextItem.url"
                  class="preview-content"
                />
                <div
                  v-else-if="nextItem.metadata.fileType === 'pdf'"
                  class="w-100 h-100 position-relative"
                >
                  <iframe
                    :src="`${nextItem.url}#page=1&toolbar=0&navpanes=0&scrollbar=0`"
                    class="w-100 h-100"
                    style="border: none; pointer-events: none"
                    scrolling="no"
                  ></iframe>
                  <!-- Overlay to prevent interaction with preview PDF -->
                  <div class="position-absolute top-0 left-0 w-100 h-100"></div>
                </div>
                <div v-else class="text-center">
                  <v-icon size="48" color="grey">
                    {{ getIcon(nextItem.metadata.fileType) }}
                  </v-icon>
                  <div class="text-caption mt-1">{{ nextItem.name }}</div>
                </div>
              </template>
              <div v-else class="text-grey text-caption">{{ $t('media.endOfSlides') }}</div>
            </div>
          </div>

          <!-- Notes -->
          <div class="flex-grow-1 d-flex flex-column">
            <v-textarea
              v-model="itemNotes"
              variant="plain"
              hide-details
              class="fill-height"
              no-resize
              :placeholder="$t('media.ClickToAddNotes')"
              @change="updateNotes"
            ></v-textarea>
          </div>
        </v-col>
      </v-row>
    </v-container>

    <!-- Grid View Overlay -->
    <v-container v-else fluid class="overflow-y-auto">
      <v-row>
        <v-col v-for="(item, index) in playlist" :key="item.id" cols="6" sm="4" md="3" lg="2">
          <v-card
            @click="jumpTo(index)"
            hover
            :color="index === currentIndex ? 'primary' : 'grey-darken-4'"
          >
            <v-img
              v-if="item.metadata.fileType === 'image'"
              :src="item.url"
              aspect-ratio="1.77"
              cover
            ></v-img>
            <v-img
              v-else-if="item.metadata.thumbnail"
              :src="item.metadata.thumbnail"
              aspect-ratio="1.77"
              cover
            >
              <div class="d-flex align-center justify-center fill-height">
                <v-icon size="36" color="white" style="text-shadow: 0 0 5px black">{{
                  getIcon(item.metadata.fileType)
                }}</v-icon>
              </div>
            </v-img>
            <div v-else class="d-flex align-center justify-center" style="aspect-ratio: 1.77">
              <v-icon size="48">{{ getIcon(item.metadata.fileType) }}</v-icon>
            </div>
            <v-card-text class="text-caption text-truncate"
              >{{ index + 1 }}. {{ item.name }}</v-card-text
            >
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { storeToRefs } from 'pinia'
import { useElectron } from '@/composables/useElectron'
import { MessageType } from '@/types/common'

import { useCardLayout } from '@/composables/useLayout'
import { APP_CONFIG } from '@/config/app'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { ViewType } from '@/types/common'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import MediaVideoControls from '@/components/Media/Preview/MediaVideoControls.vue'

const stopwatchStore = useStopwatchStore()

const { leftCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
})

const store = useMediaProjectionStore()
const {
  playlist,
  currentIndex,
  isPresenting,
  showGrid,
  currentItem,
  nextItem,
  zoomLevel,
  pan,
  isPlaying,
  pdfPage,
  volume,
} = storeToRefs(store)

const { onProjectionMessage, isElectron } = useElectron()
const { setProjectionState, sendProjectionMessage } = useProjectionMessaging()

const showZoomControls = ref(false)
const toggleZoom = (minus = false) => {
  if (showZoomControls.value) {
    showZoomControls.value = false
    store.setZoom(1)
    store.setPan(0, 0)
  } else {
    let zoomValue = 1.2
    if (minus) zoomValue = 0.8
    showZoomControls.value = true
    store.setZoom(zoomValue)
    store.setPan(0, 0)
  }
}

const zoomIn = () => {
  store.setZoom(Math.min(5, zoomLevel.value + 0.1))
}

const zoomOut = () => {
  store.setZoom(Math.max(0.1, zoomLevel.value - 0.1))
}

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
  isMuted: false, // We use 'silent' mode instead of 'muted' to keep volume UI active
  silent: true, // Use AudioContext to mute output but keep UI showing volume
  onTimeUpdate: (time) => {
    // Only update local store for UI display
    // Do NOT send to projection - projection is the leader
    if (!isSeeking.value) {
      store.setCurrentTime(time)
    }
  },
  onDurationChange: (dur) => {
    store.setDuration(dur)
    // Send duration to projection window
    sendProjectionMessage(MessageType.MEDIA_CONTROL, {
      type: 'video',
      action: 'durationchange',
      value: dur,
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

/**
 * Handles user seeking via the timeline.
 * Locks the seeking state to prevent incoming projection updates from overriding the local seek.
 */
const onSeek = (time: number) => {
  isSeeking.value = true

  // 1. Update local store
  store.setCurrentTime(time)

  // 2. Seek local video
  seekPreviewVideo(time)

  // 3. Send explicit SEEK command to projection (bypassing watcher logic)
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'seek', value: time },
    { force: true },
  )

  // Release lock after a short delay to allow seek to settle
  // This prevents the "old" time from projection (which might lag) from overwriting our new time immediately
  setTimeout(() => {
    isSeeking.value = false
  }, 500)
}

const replayVideo = () => {
  // 1. Reset ended state
  isPreviewEnded.value = false

  // 2. Update store state
  store.setCurrentTime(0)
  store.setPlaying(true)

  // 3. Operate local Preview
  seekPreviewVideo(0)
  playPreviewVideo()

  // 4. Send commands to Projection
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'seek', value: 0 },
    { force: true },
  )
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'play' },
    { force: true },
  )
}

const toggleMute = () => {
  // If volume > 0, mute (0). If 0, restore to 1 (or prev level if we stored it, but simple 1 is fine)
  setPreviewVolume(volume.value > 0 ? 0 : 1)
}

const onSeekingStart = () => {
  isSeeking.value = true
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    {
      type: 'video',
      action: 'seeking-start',
    },
    { force: true },
  )
}

const onSeekingEnd = (finalTime: number) => {
  // Lock seeking state to prevent drift correction from reverting the seek
  isSeeking.value = true

  // 1. Update local state
  store.setCurrentTime(finalTime)
  seekPreviewVideo(finalTime)

  if (!previewVideoRef.value) {
    console.error('[MediaPresenter] previewVideoRef is null!')
  }

  // 2. Send seeking-end with final position to Projection
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    {
      type: 'video',
      action: 'seeking-end',
      value: finalTime,
    },
    { force: true },
  )

  // Release lock after delay to allow projection to catch up
  setTimeout(() => {
    isSeeking.value = false
  }, 1000)
}

// Minimap Logic
// Minimap/Preview Logic
const previewContainer = ref<HTMLElement | null>(null)

const minimapViewport = computed(() => {
  // Calculates the viewport rectangle % based on zoom and pan
  const zoom = zoomLevel.value

  // Pan is now percentage-based (-0.5 to 0.5 range where 0 is center)
  // Logic: PanX=0.5 means Image moved 50% Right. Screen is relatively 50% Left.
  // Wait, I updated MediaProjection to use `pan * 100%`.
  // If Pan=0.5 -> translate(50%). Image moves Right 50% of its width.
  // Screen center (relative to image) is at 0.5 - 0.5 = 0.0 (Left Edge).

  const centerX = 0.5 - pan.value.x
  const centerY = 0.5 - pan.value.y

  const left = (centerX - 1 / zoom / 2) * 100
  const top = (centerY - 1 / zoom / 2) * 100

  return { left, top, width: 100 / zoom, height: 100 / zoom }
})

// Cursor state
const isDragging = ref(false)
const cursorStyle = computed(() => {
  if (!showZoomControls.value) return 'default'
  return isDragging.value ? 'grabbing' : 'grab'
})

const startPanDrag = (e: MouseEvent) => {
  if (!previewContainer.value || !showZoomControls.value) return
  e.preventDefault()

  isDragging.value = true

  const startX = e.clientX
  const startY = e.clientY
  const initialPan = { ...pan.value }

  const rect = previewContainer.value.getBoundingClientRect()

  // Calculate relative move as percentage of container size
  // If I move 10% of container width...
  // User requested "Inverted" previously.
  // Move Mouse Right -> Camera Right -> Image Left -> Pan Decreases.

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY

    // Convert pixel delta to percentage (0.0 - 1.0)
    const percentX = deltaX / rect.width
    const percentY = deltaY / rect.height

    // Formula: NEW = INITIAL - DELTA
    const newPanX = initialPan.x - percentX
    const newPanY = initialPan.y - percentY

    store.setPan(newPanX, newPanY)
  }

  const handleMouseUp = () => {
    isDragging.value = false
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

const videoURL = computed(() => {
  if (currentItem.value?.metadata.fileType === 'video' && currentItem.value.url) {
    // Add timestamp to force cache busting and ensure Accept-Ranges header is respected
    // This solves the issue where browser caches "non-seekable" state from previous requests
    return `${currentItem.value.url}?t=${Date.now()}`
  }
  return ''
})

const pdfUrl = computed(() => {
  if (!currentItem.value) return ''
  // Use #page=N to control PDF page if browser supports it
  return `${currentItem.value.url}#page=${pdfPage.value}&toolbar=0&navpanes=0&scrollbar=0`
})

// Video player initialization on item change
watch(
  currentItem,
  (newItem, oldItem) => {
    showZoomControls.value = false

    // Cleanup old video player
    if (oldItem?.metadata.fileType === 'video') {
      disposePreviewPlayer()
    }

    // Initialize new video player if current item is a video
    if (newItem?.metadata.fileType === 'video' && previewVideoRef.value) {
      // Use nextTick to ensure video element is mounted
      nextTick(() => {
        if (previewVideoRef.value && videoURL.value) {
          initializePreviewPlayer()
          previewVideoRef.value.src = videoURL.value
        }
      })
    }
  },
  { immediate: false },
)

// Notes handling (local ref synced to currentItem)
const itemNotes = ref('')
watch(
  currentItem,
  (newItem) => {
    if (newItem) {
      itemNotes.value = newItem.notes || ''
    }
  },
  { immediate: true },
)

const updateNotes = () => {
  if (currentItem.value) {
    currentItem.value.notes = itemNotes.value
  }
}

const getIcon = (type: string) => {
  switch (type) {
    case 'video':
      return 'mdi-video'
    case 'pdf':
      return 'mdi-file-pdf-box'
    case 'audio':
      return 'mdi-music'
    default:
      return 'mdi-file'
  }
}

const exitPresentation = async () => {
  await setProjectionState(true)
  store.exit()
}

const jumpTo = (index: number) => {
  store.jumpTo(index)
}

const nextPdfPage = () => store.setPdfPage(pdfPage.value + 1)
const prevPdfPage = () => store.setPdfPage(pdfPage.value - 1)

watch(
  playlist,
  (newVal) => {
    sendProjectionMessage(
      MessageType.MEDIA_UPDATE,
      {
        playlist: JSON.parse(JSON.stringify(newVal)), // Strip reactive proxies
        currentIndex: currentIndex.value,
        action: 'update',
      },
      { force: true },
    )
  },
  { deep: true },
)

watch(currentIndex, (val) => {
  sendProjectionMessage(
    MessageType.MEDIA_UPDATE,
    {
      currentIndex: val,
      action: 'jump',
    },
    { force: true },
  )
})

watch(zoomLevel, (val) => {
  if (val <= 1 && (pan.value.x !== 0 || pan.value.y !== 0)) {
    store.setPan(0, 0)
  }

  sendProjectionMessage(MessageType.MEDIA_CONTROL, { type: 'image', action: 'zoom', value: val })
})

watch(
  pan,
  (val) => {
    sendProjectionMessage(MessageType.MEDIA_CONTROL, {
      type: 'image',
      action: 'pan',
      value: { x: val.x, y: val.y },
    })
  },
  { deep: true },
)

watch(isPlaying, (val) => {
  // Control preview video player
  // Prevent loop: Only call play/pause if the video state doesn't match the store state
  if (currentItem.value?.metadata.fileType === 'video' && previewVideoRef.value) {
    const isPaused = previewVideoRef.value.paused

    if (val && isPaused) {
      playPreviewVideo()
    } else if (!val && !isPaused) {
      pausePreviewVideo()
    }
  }

  // Send to projection window
  sendProjectionMessage(MessageType.MEDIA_CONTROL, {
    type: 'video',
    action: val ? 'play' : 'pause',
  })
})

watch(pdfPage, (val) => {
  sendProjectionMessage(MessageType.MEDIA_CONTROL, { type: 'pdf', action: 'pdfPage', value: val })
})

watch(volume, (val) => {
  sendProjectionMessage(MessageType.MEDIA_CONTROL, {
    type: 'video',
    action: 'volume',
    value: val,
  })
})

const handleKeydown = (e: KeyboardEvent) => {
  if (!isPresenting.value) return

  // Ignore if typing in notes
  if ((e.target as HTMLElement).tagName === 'TEXTAREA') return

  switch (e.key) {
    case 'Escape':
      if (showGrid.value) {
        showGrid.value = false
        break
      }

      if (showZoomControls.value) {
        toggleZoom()
        break
      }

      exitPresentation()
      break
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case 'Enter':
    case 'n':
    case 'N':
      store.next()
      break
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
    case 'p':
    case 'P':
      store.prev()
      break
    case 'Home':
      store.jumpTo(0)
      break
    case 'End':
      store.jumpTo(playlist.value.length - 1)
      break
    case 'g':
    case 'G':
      store.toggleGrid()
      break
    case 'z':
    case 'Z':
      toggleZoom()
      break
    case '+':
    case '=':
      if (showZoomControls.value) {
        zoomIn()
      } else {
        toggleZoom()
      }
      break
    case '-':
    case '_':
      if (showZoomControls.value) {
        zoomOut()
      } else {
        toggleZoom(true)
      }
      break
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  // Ensure local stopwatch is running (persisting if already running)
  stopwatchStore.startLocal()

  if (isElectron()) {
    // Switch to Media View for projection
    await setProjectionState(false, ViewType.MEDIA)

    // Initial Sync
    sendProjectionMessage(
      MessageType.MEDIA_UPDATE,
      {
        playlist: JSON.parse(JSON.stringify(playlist.value)),
        currentIndex: currentIndex.value,
        action: 'update',
      },
      { force: true },
    )
  }

  onProjectionMessage((msg) => {
    if (msg.type === MessageType.MEDIA_CONTROL && msg.data?.type === 'video') {
      if (msg.data?.action === 'ended') {
        // Video Finished
        store.setPlaying(false)
      } else if (msg.data?.action === 'projection-time') {
        const projectionTime = Number(msg.data.value)
        // Optimization: Do NOT update store.currentTime here.
        // Let local preview drive the UI for 60fps smoothness.
        // Only use projectionTime for drift correction.

        // Sync preview video if drift > 1 second
        if (previewVideoRef.value && !isSeeking.value && isPlaying.value) {
          const previewTime = previewVideoRef.value.currentTime
          const drift = Math.abs(previewTime - projectionTime)
          if (drift > 1.0) {
            seekPreviewVideo(projectionTime)
          }
        }
      }
    }
  })

  // Initialize video player if current item is already a video
  if (currentItem.value?.metadata.fileType === 'video') {
    nextTick(() => {
      if (previewVideoRef.value && currentItem.value?.url) {
        initializePreviewPlayer()
        previewVideoRef.value.src = currentItem.value.url
      }
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopwatchStore.resetLocal()
  // Cleanup video player
  disposePreviewPlayer()
})
</script>

<style scoped>
.media-presenter {
  border-radius: inherit;
  display: flex;
  left: 0;
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 9999;
}

.live-preview-container {
  height: auto; /* Overridden by inline style */
  border: 1px solid #333;
}
.preview-content {
  max-width: 100%;
  max-height: 100%;
}
</style>
