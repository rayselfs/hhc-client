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
              @mousedown="startDrag"
            >
              <template v-if="currentItem">
                <img
                  v-if="currentItem.metadata.fileType === 'image'"
                  :src="currentItem.url"
                  class="preview-content"
                  style="object-fit: contain"
                />
                <!-- Video Preview with Controls -->
                <div
                  v-else-if="currentItem.metadata.fileType === 'video'"
                  class="d-flex flex-column align-center justify-center fill-height w-100 bg-black position-relative"
                  @mouseenter="showZoomControls = true"
                  @mouseleave="showZoomControls = false"
                >
                  <video
                    ref="videoRef"
                    :src="currentItem.url"
                    class="preview-content w-100 h-100"
                    muted
                    disablePictureInPicture
                    @loadedmetadata="onLoadedMetadata"
                    @timeupdate="onTimeUpdate"
                    style="object-fit: contain"
                  ></video>

                  <!-- Custom Video Controls Overlay -->
                  <v-fade-transition>
                    <div
                      v-if="showZoomControls || !isPlaying"
                      class="position-absolute bottom-0 w-100 pa-2"
                      style="
                        background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
                        z-index: 10;
                      "
                      @mousedown.stop
                    >
                      <!-- Progress Bar -->
                      <v-slider
                        v-model="localCurrentTime"
                        :max="duration"
                        :min="0"
                        color="primary"
                        track-color="rgba(255,255,255,0.3)"
                        thumb-size="12"
                        hide-details
                        class="mb-1"
                        @start="onSeekStart"
                        @end="onSeekEnd"
                      ></v-slider>

                      <div class="d-flex align-center justify-space-between px-2">
                        <!-- Play/Pause & Time -->
                        <div class="d-flex align-center">
                          <v-btn
                            icon
                            variant="text"
                            color="white"
                            density="compact"
                            @click.stop="togglePlay"
                          >
                            <v-icon size="28">{{ isPlaying ? 'mdi-pause' : 'mdi-play' }}</v-icon>
                          </v-btn>

                          <span class="text-caption text-white ml-2 font-weight-medium">
                            {{ formatTime(localCurrentTime) }} / {{ formatTime(duration) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </v-fade-transition>
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
                @mousedown="startDrag"
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
                @click="toggleZoomMode()"
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { storeToRefs } from 'pinia'
import { useElectron } from '@/composables/useElectron'
import { useCardLayout } from '@/composables/useLayout'
import { APP_CONFIG } from '@/config/app'
import { useStopwatchStore } from '@/stores/stopwatch'

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
  currentTime,
} = storeToRefs(store)

const { isElectron } = useElectron()

// Controls Logic
const showZoomControls = ref(false)
const toggleZoomMode = (minus = false) => {
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

const videoRef = ref<HTMLVideoElement | null>(null)
// Local duration state for UI
const duration = ref(0)
const localCurrentTime = ref(0)
const isSeeking = ref(false)

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const onLoadedMetadata = () => {
  if (videoRef.value) {
    duration.value = videoRef.value.duration
  }
}

const onTimeUpdate = () => {
  if (videoRef.value && !isSeeking.value) {
    localCurrentTime.value = videoRef.value.currentTime
    // Do not sync to store constantly here to avoid flooding IPC.
    // Sync is handled by seek/pause/play commands or major events.
  }
}

// Video Seek Logic
const lastSeekTime = ref(0)
const onSeekStart = () => {
  isSeeking.value = true
}

const onSeekEnd = () => {
  isSeeking.value = false
  const val = localCurrentTime.value
  lastSeekTime.value = Date.now()
  if (videoRef.value) {
    videoRef.value.currentTime = val
  }
  store.seek(val)
}

const togglePlay = () => {
  store.setPlaying(!isPlaying.value)
}

// Watch store state to sync local video
watch(isPlaying, (val) => {
  if (videoRef.value) {
    if (val) videoRef.value.play().catch(() => {})
    else videoRef.value.pause()
  }
})

watch(currentTime, (val) => {
  // Sync from remote if difference is significant and we are not seeking
  // Also ignore updates shortly after seeking to prevent jumping back
  if (Date.now() - lastSeekTime.value < 1000) return

  if (videoRef.value && !isSeeking.value && Math.abs(videoRef.value.currentTime - val) > 1) {
    videoRef.value.currentTime = val
  }
})

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

const startDrag = (e: MouseEvent) => {
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

// PDF handling
const pdfUrl = computed(() => {
  if (!currentItem.value) return ''
  // Use #page=N to control PDF page if browser supports it
  return `${currentItem.value.url}#page=${pdfPage.value}&toolbar=0&navpanes=0&scrollbar=0`
})

// Removed local video sync watcher since we don't play video locally anymore

watch(currentItem, () => {
  showZoomControls.value = false
})

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

// Icons
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

// Navigation & Actions
const exitPresentation = async () => {
  store.exit()
}

const jumpTo = (index: number) => {
  store.jumpTo(index)
}

const restartVideo = () => {
  if (videoRef.value) {
    videoRef.value.currentTime = 0
    videoRef.value.pause()
  }
  store.seek(0)
  store.setPlaying(false)
}

const nextPdfPage = () => store.setPdfPage(pdfPage.value + 1)
const prevPdfPage = () => store.setPdfPage(pdfPage.value - 1)

// State Synchronization with Projection Window
// We watch key state and send updates

// 1. Watch Playlist changes (Full Sync)
// State Synchronization with Projection Window
// Handled by Centralized MediaService and Store
// Watchers removed as they are no longer needed to manually send IPC.

watch(zoomLevel, (val) => {
  if (val <= 1 && (pan.value.x !== 0 || pan.value.y !== 0)) {
    store.setPan(0, 0)
  }
})

// Keyboard Shortcuts
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
        toggleZoomMode()
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
    case ' ':
      e.preventDefault()
      togglePlay()
      break
    case 'r':
    case 'R':
      restartVideo()
      break
    case 'z':
    case 'Z':
      toggleZoomMode()
      break
    case '+':
    case '=':
      if (showZoomControls.value) {
        zoomIn()
      } else {
        toggleZoomMode()
      }
      break
    case '-':
    case '_':
      if (showZoomControls.value) {
        zoomOut()
      } else {
        toggleZoomMode(true)
      }
      break
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  // Ensure local stopwatch is running (persisting if already running)
  stopwatchStore.startLocal()

  if (isElectron()) {
    // Media service handles state.
    // If we need to ensure projection is on Media View, we might need a global command,
    // but usually MediaService interactions don't force View Change unless explicit.
    // Assuming View Change is handled by Layout/Control wrapper when entering presentation.
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopwatchStore.resetLocal()
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

/* Hide native video volume controls, fullscreen, and overflow menu */
video::-webkit-media-controls-volume-slider,
video::-webkit-media-controls-mute-button,
video::-webkit-media-controls-volume-control-container,
video::-webkit-media-controls-fullscreen-button,
video::-webkit-media-controls-overflow-button,
video::-webkit-media-controls-toggle-closed-captions-button {
  display: none !important;
}

.preview-content {
  max-width: 100%;
  max-height: 100%;
}
</style>
