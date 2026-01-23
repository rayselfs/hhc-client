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
const renderedPages = ref<Set<number>>(new Set())

const containerWidth = ref(0)
const containerHeight = ref(0)

const isRendering = ref(false)
const pendingRender = ref<{ page: number; zoom: number } | null>(null)

const baseWidth = ref(0)
const baseHeight = ref(0)

const canvasStyle = computed(() => {
  const zoomedWidth = baseWidth.value * props.zoom
  const zoomedHeight = baseHeight.value * props.zoom
  return {
    width: zoomedWidth > 0 ? `${zoomedWidth}px` : 'auto',
    height: zoomedHeight > 0 ? `${zoomedHeight}px` : 'auto',
    transform: `translate(${props.pan.x * 100}%, ${props.pan.y * 100}%)`,
    transformOrigin: 'center center',
    transition: 'transform 0.1s ease-out',
  }
})

const setPageCanvasRef = (el: HTMLCanvasElement | null, page: number) => {
  if (el) {
    pageCanvasRefs.value.set(page, el)
  } else {
    pageCanvasRefs.value.delete(page)
  }
}

const calculateBaseSize = async (): Promise<{ width: number; height: number }> => {
  const service = getService()
  const dims = await service.getPageDimensions(currentPage.value)
  if (!dims) return { width: 0, height: 0 }

  const scaleX = containerWidth.value / dims.width
  const scaleY = containerHeight.value / dims.height
  const scale = Math.min(scaleX, scaleY)

  return {
    width: dims.width * scale,
    height: dims.height * scale,
  }
}

const renderCurrentPage = async () => {
  if (!canvasRef.value || isLoading.value || error.value) return
  if (containerWidth.value <= 0 || containerHeight.value <= 0) return

  if (isRendering.value) {
    pendingRender.value = { page: currentPage.value, zoom: props.zoom }
    return
  }

  isRendering.value = true

  try {
    const base = await calculateBaseSize()
    baseWidth.value = base.width
    baseHeight.value = base.height

    const dpr = window.devicePixelRatio || 1
    const effectiveZoom = props.zoom * dpr

    await renderPage(canvasRef.value, {
      fitMode: 'page',
      containerWidth: base.width * effectiveZoom,
      containerHeight: base.height * effectiveZoom,
    })

    const zoomedWidth = base.width * props.zoom
    const zoomedHeight = base.height * props.zoom
    canvasRef.value.style.width = `${zoomedWidth}px`
    canvasRef.value.style.height = `${zoomedHeight}px`
  } catch (e) {
    console.error('Failed to render page:', e)
  } finally {
    isRendering.value = false

    if (pendingRender.value !== null) {
      const pending = pendingRender.value
      pendingRender.value = null
      if (pending.page !== currentPage.value || pending.zoom !== props.zoom) {
        currentPage.value = pending.page
        await renderCurrentPage()
      }
    }
  }
}

const renderScrollPage = async (page: number) => {
  const canvas = pageCanvasRefs.value.get(page)
  if (!canvas || renderedPages.value.has(page)) return

  try {
    const dpr = window.devicePixelRatio || 1
    await renderPageNumber(canvas, page, {
      fitMode: 'width',
      containerWidth: containerWidth.value * dpr,
      containerHeight: containerHeight.value * dpr,
    })
    canvas.style.width = `${canvas.width / dpr}px`
    canvas.style.height = `${canvas.height / dpr}px`
    renderedPages.value.add(page)
  } catch (e) {
    if ((e as Error)?.name === 'RenderingCancelledException') return
    console.error(`Failed to render page ${page}:`, e)
  }
}

const renderVisiblePages = async () => {
  if (!scrollContainerRef.value || pdfViewMode.value !== 'scroll') return

  const container = scrollContainerRef.value
  const containerRect = container.getBoundingClientRect()

  const pageWrappers = container.querySelectorAll<HTMLElement>('.pdf-page-wrapper')
  const buffer = 2

  let firstVisible = -1
  let lastVisible = -1

  pageWrappers.forEach((wrapper, index) => {
    const wrapperRect = wrapper.getBoundingClientRect()
    const isVisible =
      wrapperRect.bottom > containerRect.top && wrapperRect.top < containerRect.bottom

    if (isVisible) {
      if (firstVisible === -1) firstVisible = index
      lastVisible = index
    }
  })

  if (firstVisible === -1) return

  const startPage = Math.max(1, firstVisible + 1 - buffer)
  const endPage = Math.min(pageCount.value, lastVisible + 1 + buffer)

  for (let page = startPage; page <= endPage; page++) {
    await renderScrollPage(page)
  }

  const scrollTop = container.scrollTop
  const centerY = scrollTop + containerRect.height / 2
  let detectedPage = 1

  pageWrappers.forEach((wrapper, index) => {
    const wrapperTop = wrapper.offsetTop
    const wrapperHeight = wrapper.offsetHeight
    if (centerY >= wrapperTop && centerY < wrapperTop + wrapperHeight) {
      detectedPage = index + 1
    }
  })

  if (detectedPage !== currentPage.value) {
    currentPage.value = detectedPage
    emit('pageChange', detectedPage)
  }
}

const onScroll = () => {
  renderVisiblePages()
}

watch(
  () => props.url,
  async (url) => {
    if (!url) return

    renderedPages.value.clear()
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
    renderedPages.value.clear()

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
      renderedPages.value.clear()
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
