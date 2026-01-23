<template>
  <div class="media-presenter fill-height d-flex flex-column bg-black">
    <!-- Main Content Area with Vuetify Grid -->
    <!-- Use v-show instead of v-if to preserve video player state when toggling grid -->
    <v-container v-show="!showGrid" fluid class="flex-grow-1 overflow-hidden pa-0">
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
                  class="fill-height w-100 d-flex align-center justify-center bg-black position-relative"
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
                  class="position-relative w-100 h-100 d-flex align-center justify-center"
                >
                  <!-- PDF Sidebar (uses pdfStore internally) -->
                  <PdfSidebar />

                  <!-- PDF Viewer (canvas-based) -->
                  <PdfViewer
                    ref="pdfViewerRef"
                    :url="currentItem.url"
                    :page="pdfStore.currentPage"
                    :view-mode="pdfStore.viewMode"
                    :zoom="zoomLevel"
                    :pan="pan"
                    class="w-100 h-100"
                    @loaded="onPdfLoaded"
                    @page-change="onPdfPageChange"
                  />

                  <!-- PDF Controls Overlay (bottom-left, like video controls) -->
                  <PdfPresenterControls
                    class="position-absolute bottom-0 left-0 ma-2"
                    style="z-index: 20"
                    @view-mode-change="handlePdfViewModeChange"
                  />
                </div>
              </template>

              <!-- Viewport Frame Overlay -->
              <div
                v-if="showZoomControls && currentItem?.metadata.fileType !== 'pdf'"
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

              <!-- Drag Overlay for PDF (To capture mouse events over iframe) -->
              <div
                v-if="currentItem?.metadata.fileType === 'pdf' && showZoomControls"
                class="position-absolute w-100 h-100 top-0 left-0"
                style="z-index: 5; cursor: grab"
                @mousedown="startPanDrag"
              ></div>

              <!-- Zoom Controls -->
              <v-fade-transition>
                <liquid-container
                  v-if="showZoomControls || zoomLevel > 1"
                  class="position-absolute bottom-0 right-0 ma-2 d-flex align-center zoom-controls"
                  style="z-index: 10"
                  padding="pa-2"
                  mode="advanced"
                  @mousedown.stop
                >
                  <div class="d-flex align-center ga-1">
                    <v-btn
                      size="x-small"
                      icon="mdi-minus"
                      variant="text"
                      @click.stop="zoomOut"
                    ></v-btn>
                    <v-btn
                      size="small"
                      variant="text"
                      @click.stop="resetZoom"
                      style="min-width: 50px"
                    >
                      {{ Math.round(zoomLevel * 100) }}
                    </v-btn>
                    <v-btn
                      size="x-small"
                      icon="mdi-plus"
                      variant="text"
                      @click.stop="zoomIn"
                    ></v-btn>
                  </div>
                </liquid-container>
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
                :disabled="!currentItem"
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
            <liquid-btn
              icon="mdi-chevron-left"
              variant="outlined"
              class="rounded-circle mr-2"
              @click="store.prev()"
              :disabled="currentIndex <= 0"
            ></liquid-btn>
            <!-- Center: Text & Progress -->
            <div class="flex-grow-1 mr-2" style="max-width: 200px">
              <div class="text-subtitle-1 mb-1">
                Slide {{ currentIndex + 1 }} / {{ playlist.length }}
              </div>
              <liquid-progress :model-value="((currentIndex + 1) / playlist.length) * 100" />
            </div>

            <!-- Next Button -->
            <liquid-btn
              icon="mdi-chevron-right"
              variant="outlined"
              class="rounded-circle"
              @click="store.next()"
              :disabled="currentIndex >= playlist.length - 1"
            ></liquid-btn>
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
              <MediaThumbnail
                v-if="nextItem"
                :item="nextItem"
                :fallback-icon="getIcon(nextItem.metadata.fileType)"
                class="preview-content rounded"
                style="width: 100%; height: 100%"
              >
                <template #placeholder>
                  <div class="text-center">
                    <v-icon size="48" color="grey">
                      {{ getIcon(nextItem.metadata.fileType) }}
                    </v-icon>
                    <div class="text-caption mt-1">{{ nextItem.name }}</div>
                  </div>
                </template>
              </MediaThumbnail>
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
    <v-container v-show="showGrid" fluid class="overflow-y-auto">
      <v-row>
        <v-col v-for="(item, index) in playlist" :key="item.id" cols="6" sm="4" md="3" lg="2">
          <v-card
            @click="jumpTo(index)"
            hover
            :color="index === currentIndex ? 'primary' : 'grey-darken-4'"
          >
            <MediaThumbnail
              :item="item"
              aspect-ratio="1.77"
              :fallback-icon="getIcon(item.metadata.fileType)"
              :cover="true"
            >
              <div
                v-if="item.metadata.fileType !== 'image'"
                class="d-flex align-center justify-center fill-height"
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%"
              >
                <v-icon size="36" color="white" style="text-shadow: 0 0 5px black">{{
                  getIcon(item.metadata.fileType)
                }}</v-icon>
              </div>
            </MediaThumbnail>
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
import { useProjectionManager } from '@/composables/useProjectionManager'
import { ViewType } from '@/types/common'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import MediaVideoControls from '@/components/Media/Preview/MediaVideoControls.vue'
import MediaThumbnail from '@/components/Media/MediaThumbnail.vue'
import PdfViewer from '@/components/Media/PdfViewer.vue'
import PdfPresenterControls from '@/components/Media/PdfPresenterControls.vue'
import PdfSidebar from '@/components/Media/PdfSidebar.vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { PdfViewMode } from '@/composables/usePdf'
import { usePdfPresenterStore } from '@/stores/pdfPresenter'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'
import { needsTranscode, buildVideoUrl } from '@/utils/videoUtils'

const stopwatchStore = useStopwatchStore()

const { leftCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
})

const store = useMediaProjectionStore()
const pdfStore = usePdfPresenterStore()
const {
  playlist,
  currentIndex,
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
const { setProjectionState, sendProjectionMessage } = useProjectionManager()

const showZoomControls = ref(false)
const pdfViewerRef = ref<InstanceType<typeof PdfViewer> | null>(null)

const toggleZoom = (minus = false) => {
  if (showZoomControls.value) {
    // Deactivating zoom mode: reset zoom and pan
    showZoomControls.value = false
    store.setZoom(1)
    store.setPan(0, 0)
  } else {
    // Activating zoom mode: set initial zoom level
    const zoomValue = minus ? 0.8 : 1.2
    showZoomControls.value = true
    store.setZoom(zoomValue)
    store.setPan(0, 0)
  }
}

const resetZoom = () => {
  store.setPan(0, 0)
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
    // If we have a reliable duration from ffprobe metadata, prefer that
    // over the video element's reported duration (which can be inaccurate for transcoded streams)
    const metadataDuration = currentItem.value?.metadata?.duration
    const effectiveDuration = metadataDuration && metadataDuration > 0 ? metadataDuration : dur

    store.setDuration(effectiveDuration)
    // Send duration to projection window
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

/**
 * Handles user seeking via the timeline (during drag).
 * For native videos (MP4, WebM), performs immediate seek.
 * For transcoded videos (MKV, AVI), seeking is DISABLED.
 */
const onSeek = (time: number) => {
  if (needsTranscodeComputed.value) return

  isSeeking.value = true

  // 1. Update local store for UI display
  store.setCurrentTime(time)

  // For native videos (MP4, WebM), perform immediate seek
  seekPreviewVideo(time)

  // Send explicit SEEK command to projection (bypassing watcher logic)
  sendProjectionMessage(
    MessageType.MEDIA_CONTROL,
    { type: 'video', action: 'seek', value: time },
    { force: true },
  )
}

const replayVideo = () => {
  // 1. Reset ended state
  isPreviewEnded.value = false

  // 2. Update store state
  store.setCurrentTime(0)
  store.setPlaying(true)

  // 3. For transcoded videos, reload from beginning
  if (needsTranscodeComputed.value) {
    // Reload from beginning and auto-play
    initializeCurrentVideo(true)

    // Send seek to 0 to trigger projection reload for transcoded videos
    sendProjectionMessage(
      MessageType.MEDIA_CONTROL,
      { type: 'video', action: 'seek', value: 0 },
      { force: true },
    )
  } else {
    // Native seek for MP4, WebM
    seekPreviewVideo(0)
    playPreviewVideo()

    // Send commands to Projection
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
  // If volume > 0, mute (0). If 0, restore to 1 (or prev level if we stored it, but simple 1 is fine)
  setPreviewVolume(volume.value > 0 ? 0 : 1)
}

const onSeekingStart = () => {
  if (needsTranscodeComputed.value) return

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
  if (needsTranscodeComputed.value) return

  // Lock seeking state to prevent drift correction from reverting the seek
  isSeeking.value = true

  // 1. Update local state
  store.setCurrentTime(finalTime)

  // 2. Native seek
  seekPreviewVideo(finalTime)

  if (!previewVideoRef.value) {
    console.error('[MediaPresenter] previewVideoRef is null!')
  }

  // Send seeking-end with final position to Projection
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
  // This must be window-size-independent (works in normalized 0-1 coordinates)
  const zoom = zoomLevel.value

  // CSS transform in MediaProjection: scale(zoom) translate(pan.x * 100%, pan.y * 100%)
  // Transforms compose right-to-left: translate first (in scaled space), then scale
  // This means translate % is relative to ORIGINAL element size
  //
  // Viewport center in normalized original coordinates:
  // centerX = 0.5 - pan.x
  // centerY = 0.5 - pan.y
  const centerX = 0.5 - pan.value.x
  const centerY = 0.5 - pan.value.y

  // Viewport size as fraction of original: 1/zoom
  const viewportWidth = 1 / zoom
  const viewportHeight = 1 / zoom

  // Convert to percentage for CSS positioning
  const left = (centerX - viewportWidth / 2) * 100
  const top = (centerY - viewportHeight / 2) * 100

  return { left, top, width: viewportWidth * 100, height: viewportHeight * 100 }
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

  // User requested "Inverted" previously.
  // Move Mouse Right -> Camera Right -> Image Left -> Pan Decreases.
  //
  // With transform: scale(zoom) translate(pan%)
  // translate % is relative to original size, so pan change = mouse movement %

  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY

    // Convert pixel delta to percentage (0.0 - 1.0) of container
    const percentX = deltaX / rect.width
    const percentY = deltaY / rect.height

    // Direct mapping: pan change = desired viewport shift
    // For PDF: Hand Tool (content follows mouse) -> ADD delta
    // For Image: Camera Move (viewport moves) -> SUBTRACT delta
    const isPdf = currentItem.value?.metadata.fileType === 'pdf'
    const factor = isPdf ? 1 : -1

    const newPanX = initialPan.x + percentX * factor
    const newPanY = initialPan.y + percentY * factor

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

const onPdfLoaded = (metadata: { pageCount: number; title?: string; author?: string }) => {
  pdfStore.setPageCount(metadata.pageCount)
  pdfStore.setPdfService(pdfViewerRef.value?.getService() ?? null)
  store.setPdfPageCount(metadata.pageCount)
  sendProjectionMessage(MessageType.MEDIA_CONTROL, {
    type: 'pdf',
    action: 'pdfPageCount',
    value: metadata.pageCount,
  })
}

const onPdfPageChange = (page: number) => {
  pdfStore.setPage(page)
  store.setPdfPage(page)
}

const handlePdfViewModeChange = (mode: PdfViewMode) => {
  store.setPdfViewMode(mode)
  sendProjectionMessage(MessageType.MEDIA_CONTROL, {
    type: 'pdf',
    action: 'pdfViewMode',
    value: mode,
  })
}

const needsTranscodeComputed = computed(() => {
  const url = currentItem.value?.url
  if (!url) return false
  return needsTranscode(url)
})

/**
 * Build video URL with optional seek parameter for transcoded videos
 * Now using shared utility from @/utils/videoUtils
 */
const buildVideoUrlForPreview = (baseUrl: string): string => {
  return buildVideoUrl({
    baseUrl,
    isTranscoded: needsTranscodeComputed.value,
    window: 'preview',
  })
}

/**
 * Initialize or reinitialize video player for current item
 * This function handles all video initialization logic in one place
 * @param autoPlay - Whether to auto-play after initialization (default: false)
 */
const initializeCurrentVideo = (autoPlay = false) => {
  const item = currentItem.value
  if (!item || item.metadata.fileType !== 'video') return

  // Reset video state for new/reinitialized item
  isPreviewEnded.value = false

  // If metadata has duration from ffprobe, use it immediately
  const metadataDuration =
    item.metadata.duration && item.metadata.duration > 0 ? item.metadata.duration : 0
  if (metadataDuration > 0) {
    store.setDuration(metadataDuration)
    // Also send to projection
    sendProjectionMessage(MessageType.MEDIA_CONTROL, {
      type: 'video',
      action: 'durationchange',
      value: metadataDuration,
    })
  }

  // Use nextTick to ensure video element is mounted
  nextTick(() => {
    if (previewVideoRef.value && item.url) {
      // Dispose old player first to ensure clean state
      disposePreviewPlayer()

      // Initialize new player
      initializePreviewPlayer()

      // Build video URL (no seek support for transcoded videos)
      const videoSrc = buildVideoUrlForPreview(item.url)
      previewVideoRef.value.src = videoSrc

      // Auto-play after video is ready (for replay scenario)
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

// Video player initialization on item change
watch(
  currentItem,
  (newItem, oldItem) => {
    showZoomControls.value = false
    pdfStore.reset()

    // Cleanup old video player
    if (oldItem?.metadata.fileType === 'video') {
      disposePreviewPlayer()
    }

    // Initialize new video player if current item is a video
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
  // Removed auto-pan-reset when zoomLevel <= 1
  // User can now pan at any zoom level while in zoom mode
  // Pan is only reset when explicitly exiting zoom mode via toggleZoom()

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
      // Reset playbackRate when paused (in case drift correction adjusted it)
      previewVideoRef.value.playbackRate = 1.0
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

watch(
  () => pdfStore.currentPage,
  (val) => {
    store.setPdfPage(val)
    sendProjectionMessage(MessageType.MEDIA_CONTROL, { type: 'pdf', action: 'pdfPage', value: val })
  },
)

watch(volume, (val) => {
  sendProjectionMessage(MessageType.MEDIA_CONTROL, {
    type: 'video',
    action: 'volume',
    value: val,
  })
})

const handleEscape = () => {
  if (showGrid.value) {
    showGrid.value = false
    return
  }

  if (showZoomControls.value) {
    toggleZoom()
    return
  }

  exitPresentation()
}

const handleVideoTogglePlay = () => {
  if (currentItem.value?.metadata.fileType !== 'video') return

  if (isPreviewEnded.value) {
    replayVideo()
  } else if (isPlaying.value) {
    pausePreviewVideo()
  } else {
    playPreviewVideo()
  }
}

const handlePdfToggleViewMode = () => {
  if (currentItem.value?.metadata.fileType !== 'pdf') return
  const newMode = pdfStore.viewMode === 'slide' ? 'scroll' : 'slide'
  pdfStore.setViewMode(newMode)
  handlePdfViewModeChange(newMode)
}

useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.ESCAPE,
    handler: handleEscape,
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.NEXT_SLIDE,
    handler: () => store.next(),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.PREV_SLIDE,
    handler: () => store.prev(),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.FIRST_SLIDE,
    handler: () => store.jumpTo(0),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.LAST_SLIDE,
    handler: () => store.jumpTo(playlist.value.length - 1),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.TOGGLE_GRID,
    handler: () => store.toggleGrid(),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.TOGGLE_ZOOM,
    handler: () => toggleZoom(),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.ZOOM_IN,
    handler: () => {
      if (showZoomControls.value) {
        zoomIn()
      } else {
        toggleZoom()
      }
    },
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.ZOOM_OUT,
    handler: () => {
      if (showZoomControls.value) {
        zoomOut()
      } else {
        toggleZoom(true)
      }
    },
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.VIDEO_TOGGLE_PLAY,
    handler: handleVideoTogglePlay,
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.PDF_TOGGLE_VIEW_MODE,
    handler: handlePdfToggleViewMode,
  },
])

onMounted(async () => {
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

        // Drift correction using playbackRate adjustment
        if (previewVideoRef.value && !isSeeking.value && isPlaying.value) {
          // For transcoded videos, projection reports raw video.currentTime
          // We need to compare apples to apples (both raw times, without offset)
          const previewRawTime = previewVideoRef.value.currentTime

          const drift = previewRawTime - projectionTime // positive = preview ahead, negative = preview behind

          // Large drift (> 1 second): hard seek
          if (Math.abs(drift) > 1.0) {
            seekPreviewVideo(projectionTime)
            previewVideoRef.value.playbackRate = 1.0
          }
          // Medium drift (0.1 - 1 second): adjust playback rate to catch up/slow down
          else if (Math.abs(drift) > 0.1) {
            // Adjust rate: if preview is ahead, slow down; if behind, speed up
            // Use gentle adjustment (±5%) to avoid noticeable audio pitch change
            previewVideoRef.value.playbackRate = drift > 0 ? 0.95 : 1.05
          }
          // Small drift (< 0.1 second): reset to normal rate
          else if (previewVideoRef.value.playbackRate !== 1.0) {
            previewVideoRef.value.playbackRate = 1.0
          }
        }
      }
    }
  })

  // Initialize video player if current item is already a video
  if (currentItem.value?.metadata.fileType === 'video') {
    initializeCurrentVideo()
  }
})

onUnmounted(() => {
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
