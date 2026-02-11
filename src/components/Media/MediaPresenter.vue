<template>
  <div class="media-presenter fill-height d-flex flex-column bg-black">
    <v-container v-show="!showGrid" fluid class="flex-grow-1 overflow-hidden pa-0">
      <v-row no-gutters class="fill-height">
        <!-- Left Column: Main Preview & Controls (cols=8) -->
        <v-col cols="8" class="d-flex flex-column pa-4 border-e">
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
                <!-- PDF Slideshow -->
                <PdfSlideshow
                  v-if="currentItem.metadata.fileType === 'pdf'"
                  :item="currentItem"
                  :show-zoom-controls="showZoomControls"
                  @start-drag="startPanDrag"
                />
                <!-- Image/Video Player -->
                <MediaPlayer
                  v-else
                  ref="mediaPlayerRef"
                  :item="currentItem"
                  :show-zoom-controls="showZoomControls"
                />
              </template>

              <!-- Zoom Controls Overlay -->
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
            </div>

            <!-- Control Bar (Under Preview) -->
            <div class="d-flex justify-start align-center gap-4 py-2">
              <v-btn
                variant="text"
                icon
                size="large"
                @click="store.toggleGrid()"
                :title="$t('media.slideNavigator')"
              >
                <v-icon size="32">mdi-view-grid</v-icon>
              </v-btn>
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
          <MediaPresenterNavigation
            :current-index="currentIndex"
            :playlist-length="playlist.length"
          />
        </v-col>

        <!-- Right Column: Next Slide & Notes (cols=4) -->
        <MediaPresenterSidebar
          :current-item="currentItem"
          :next-item="nextItem"
          @update:notes="handleNotesUpdate"
        />
      </v-row>
    </v-container>

    <!-- Grid View Overlay -->
    <MediaPresenterGrid
      v-show="showGrid"
      :playlist="playlist"
      :current-index="currentIndex"
      @jump="jumpTo"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { usePdfPresenterStore } from '@/stores/pdfPresenter'
import { useStopwatchStore } from '@/stores/stopwatch'
import { useElectron } from '@/composables/useElectron'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { useCardLayout } from '@/composables/useLayout'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMediaZoom } from '@/composables/useMediaZoom'
import { APP_CONFIG } from '@/config/app'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'
import { MessageType, ViewType } from '@/types/projection'

import PdfSlideshow from '@/components/Media/Preview/PdfSlideshow.vue'
import MediaPlayer from '@/components/Media/Preview/MediaPlayer.vue'
import MediaPresenterNavigation from '@/components/Media/Preview/MediaPresenterNavigation.vue'
import MediaPresenterSidebar from '@/components/Media/Preview/MediaPresenterSidebar.vue'
import MediaPresenterGrid from '@/components/Media/Preview/MediaPresenterGrid.vue'

const stopwatchStore = useStopwatchStore()
const store = useMediaProjectionStore()
const pdfStore = usePdfPresenterStore()
const { leftCardHeight } = useCardLayout({ minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT })
const { playlist, currentIndex, showGrid, currentItem, nextItem } = storeToRefs(store)

const { isElectron } = useElectron()
const { setProjectionState, sendProjectionMessage } = useProjectionManager()

const previewContainer = ref<HTMLElement | null>(null)
const mediaPlayerRef = ref<InstanceType<typeof MediaPlayer> | null>(null)

// Zoom & Pan (extracted to composable)
const {
  showZoomControls,
  zoomLevel,
  cursorStyle,
  toggleZoom,
  resetZoom,
  zoomIn,
  zoomOut,
  startPanDrag,
} = useMediaZoom({ previewContainer, currentItem })

// Lifecycle
const exitPresentation = async () => {
  await setProjectionState(true)
  store.exit()
}

const jumpTo = (index: number) => store.jumpTo(index)

watch(playlist, (newVal) =>
  sendProjectionMessage(
    MessageType.MEDIA_UPDATE,
    {
      playlist: JSON.parse(JSON.stringify(newVal)),
      currentIndex: currentIndex.value,
      action: 'update',
    },
    { force: true },
  ),
)

watch(currentIndex, (val) => {
  showZoomControls.value = false
  pdfStore.reset()
  sendProjectionMessage(
    MessageType.MEDIA_UPDATE,
    { currentIndex: val, action: 'jump' },
    { force: true },
  )
})

useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.ESCAPE,
    handler: () =>
      showGrid.value
        ? (showGrid.value = false)
        : showZoomControls.value
          ? toggleZoom()
          : exitPresentation(),
  },
  { config: KEYBOARD_SHORTCUTS.MEDIA.NEXT_SLIDE, handler: () => store.next() },
  { config: KEYBOARD_SHORTCUTS.MEDIA.PREV_SLIDE, handler: () => store.prev() },
  { config: KEYBOARD_SHORTCUTS.MEDIA.FIRST_SLIDE, handler: () => store.jumpTo(0) },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.LAST_SLIDE,
    handler: () => store.jumpTo(playlist.value.length - 1),
  },
  { config: KEYBOARD_SHORTCUTS.MEDIA.TOGGLE_GRID, handler: () => store.toggleGrid() },
  { config: KEYBOARD_SHORTCUTS.MEDIA.TOGGLE_ZOOM, handler: () => toggleZoom() },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.ZOOM_IN,
    handler: () => (showZoomControls.value ? zoomIn() : toggleZoom()),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.ZOOM_OUT,
    handler: () => (showZoomControls.value ? zoomOut() : toggleZoom(true)),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.VIDEO_TOGGLE_PLAY,
    handler: () => mediaPlayerRef.value?.togglePlay(),
  },
  {
    config: KEYBOARD_SHORTCUTS.MEDIA.PDF_TOGGLE_VIEW_MODE,
    handler: () => {
      if (currentItem.value?.metadata.fileType !== 'pdf') return
      const newMode = pdfStore.viewMode === 'slide' ? 'scroll' : 'slide'
      pdfStore.setViewMode(newMode)
      store.setPdfViewMode(newMode)
      sendProjectionMessage(MessageType.MEDIA_CONTROL, {
        type: 'pdf',
        action: 'pdfViewMode',
        value: newMode,
      })
    },
  },
])

onMounted(async () => {
  stopwatchStore.startLocal()
  if (isElectron()) {
    await setProjectionState(false, ViewType.MEDIA)
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
})

onUnmounted(() => stopwatchStore.resetLocal())

// Handle notes updates emitted from sidebar
const handleNotesUpdate = (notes: string) => {
  store.updateCurrentItemNotes(notes)
}
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
  height: auto;
  border: 1px solid #333;
}

.preview-content {
  max-width: 100%;
  max-height: 100%;
}
</style>
