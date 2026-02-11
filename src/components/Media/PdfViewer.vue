<template>
  <div ref="containerRef" class="pdf-viewer" :class="{ 'scroll-mode': viewMode === 'scroll' }">
    <!-- Loading State -->
    <div v-if="isLoading" class="pdf-loading d-flex align-center justify-center fill-height">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="pdf-error d-flex flex-column align-center justify-center fill-height"
    >
      <v-icon size="48" color="error">mdi-alert-circle</v-icon>
      <div class="text-body-1 mt-2">{{ error }}</div>
    </div>

    <!-- Slide Mode: Single Page Canvas -->
    <template v-else-if="viewMode === 'slide'">
      <canvas ref="canvasRef" class="pdf-canvas" :style="canvasStyle" />
    </template>

    <!-- Scroll Mode: Multi-page Container -->
    <div v-else ref="scrollContainerRef" class="pdf-scroll-container" @scroll="onScroll">
      <div v-for="page in pageCount" :key="page" class="pdf-page-wrapper" :data-page="page">
        <canvas
          :ref="(el) => setPageCanvasRef(el as HTMLCanvasElement | null, page)"
          class="pdf-page"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { usePdf, type PdfViewMode } from '@/composables/usePdf'
import { usePdfRenderer } from '@/composables/usePdfRenderer'
import { useResizeObserver } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    url: string
    page?: number
    viewMode?: PdfViewMode
    zoom?: number
    pan?: { x: number; y: number }
  }>(),
  {
    page: 1,
    viewMode: 'slide',
    zoom: 1,
    pan: () => ({ x: 0, y: 0 }),
  },
)

const emit = defineEmits<{
  (e: 'pageChange', page: number): void
  (e: 'pageCountChange', count: number): void
  (e: 'loaded', metadata: { pageCount: number; title?: string; author?: string }): void
  (e: 'error', message: string): void
}>()

const {
  pageCount,
  currentPage,
  isLoading,
  error,
  viewMode: pdfViewMode,
  loadPdf,
  renderPage,
  renderPageNumber,
  dispose,
  metadata,
  getService,
} = usePdf({
  viewMode: props.viewMode,
})

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)
const pageCanvasRefs = ref<Map<number, HTMLCanvasElement>>(new Map())

const containerWidth = ref(0)
const containerHeight = ref(0)

const {
  canvasStyle,
  baseWidth,
  baseHeight,
  renderCurrentPage,
  renderVisiblePages,
  onScroll,
  clearRenderedPages,
} = usePdfRenderer({
  pdfComposable: {
    pageCount,
    currentPage,
    isLoading,
    error,
    viewMode: pdfViewMode,
    metadata,
    loadPdf,
    renderPage,
    renderPageNumber,
    nextPage: () => {},
    prevPage: () => {},
    goToPage: () => {},
    generateThumbnail: async () => null,
    dispose,
    getService,
  },
  containerWidth,
  containerHeight,
  canvasRef,
  scrollContainerRef,
  pageCanvasRefs,
  zoom: computed(() => props.zoom),
  pan: computed(() => props.pan),
  emit: (event, page) => emit(event, page),
})

const setPageCanvasRef = (el: HTMLCanvasElement | null, page: number) => {
  if (el) {
    pageCanvasRefs.value.set(page, el)
  } else {
    pageCanvasRefs.value.delete(page)
  }
}

watch(
  () => props.url,
  async (url) => {
    if (!url) return

    clearRenderedPages()
    baseWidth.value = 0
    baseHeight.value = 0

    const success = await loadPdf(url)

    if (success && metadata.value) {
      emit('loaded', {
        pageCount: metadata.value.pageCount,
        title: metadata.value.title,
        author: metadata.value.author,
      })
      emit('pageCountChange', pageCount.value)

      await nextTick()

      if (pdfViewMode.value === 'slide') {
        await renderCurrentPage()
      } else {
        await renderVisiblePages()
      }
    } else if (error.value) {
      emit('error', error.value)
    }
  },
  { immediate: true },
)

watch(
  () => props.page,
  (newPage) => {
    if (newPage !== currentPage.value && newPage >= 1 && newPage <= pageCount.value) {
      currentPage.value = newPage

      if (pdfViewMode.value === 'slide') {
        renderCurrentPage()
      } else {
        const pageWrapper = scrollContainerRef.value?.querySelector(`[data-page="${newPage}"]`)
        pageWrapper?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  },
)

watch(currentPage, (page) => {
  if (page !== props.page) {
    emit('pageChange', page)
  }
})

watch(
  () => props.viewMode,
  async (mode) => {
    pdfViewMode.value = mode
    clearRenderedPages()

    await nextTick()

    if (mode === 'slide') {
      await renderCurrentPage()
    } else {
      await renderVisiblePages()
    }
  },
)

watch(currentPage, () => {
  if (pdfViewMode.value === 'slide') {
    renderCurrentPage()
  }
})

watch(
  () => props.zoom,
  () => {
    if (pdfViewMode.value === 'slide') {
      renderCurrentPage()
    }
  },
)

useResizeObserver(containerRef, (entries) => {
  const entry = entries[0]
  if (entry) {
    containerWidth.value = entry.contentRect.width
    containerHeight.value = entry.contentRect.height

    if (pdfViewMode.value === 'slide') {
      renderCurrentPage()
    } else {
      clearRenderedPages()
      renderVisiblePages()
    }
  }
})

defineExpose({
  renderCurrentPage,
  pageCount,
  currentPage,
  getService,
  baseWidth,
  baseHeight,
})

onUnmounted(() => {
  dispose()
})
</script>

<style scoped lang="scss">
.pdf-viewer {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: transparent;

  &.scroll-mode {
    align-items: flex-start;
  }
}

.pdf-loading,
.pdf-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.pdf-canvas {
  display: block;
}

.pdf-scroll-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.pdf-page-wrapper {
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  background: white;
}

.pdf-page {
  display: block;
}
</style>
