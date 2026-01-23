<template>
  <div
    ref="stripRef"
    class="pdf-thumbnail-strip"
    @wheel.prevent="onWheel"
  >
    <div
      v-for="page in pageCount"
      :key="page"
      class="thumbnail-item"
      :class="{ active: page === currentPage }"
      :data-page="page"
      @click="$emit('goToPage', page)"
    >
      <div class="thumbnail-canvas-wrapper">
        <canvas
          :ref="(el) => setThumbnailRef(el as HTMLCanvasElement | null, page)"
          class="thumbnail-canvas"
        />
        <div v-if="!renderedPages.has(page)" class="thumbnail-placeholder d-flex align-center justify-center">
          <v-progress-circular size="20" width="2" indeterminate color="grey" />
        </div>
      </div>
      <span class="page-number">{{ page }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { PdfService } from '@/services/pdf'

const props = defineProps<{
  /** PDF file URL */
  url: string
  /** Total number of pages */
  pageCount: number
  /** Current page number (1-indexed) */
  currentPage: number
  /** Thumbnail width in pixels */
  thumbnailWidth?: number
}>()

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const emit = defineEmits<{
  (e: 'goToPage', page: number): void
}>()

const thumbnailWidth = props.thumbnailWidth ?? 100

// Refs
const stripRef = ref<HTMLElement | null>(null)
const thumbnailRefs = ref<Map<number, HTMLCanvasElement>>(new Map())
const renderedPages = ref<Set<number>>(new Set())
const pdfService = ref<PdfService | null>(null)

// Set thumbnail canvas ref
const setThumbnailRef = (el: HTMLCanvasElement | null, page: number) => {
  if (el) {
    thumbnailRefs.value.set(page, el)
  } else {
    thumbnailRefs.value.delete(page)
  }
}

// Render a single thumbnail
const renderThumbnail = async (page: number) => {
  const canvas = thumbnailRefs.value.get(page)
  if (!canvas || !pdfService.value || renderedPages.value.has(page)) return

  try {
    await pdfService.value.renderPage(canvas, page, {
      fitMode: 'width',
      containerWidth: thumbnailWidth,
      containerHeight: thumbnailWidth * 1.4, // Approximate A4 aspect ratio
    })
    renderedPages.value.add(page)
  } catch (e) {
    console.error(`Failed to render thumbnail for page ${page}:`, e)
  }
}

// Render visible thumbnails plus buffer
const renderVisibleThumbnails = async () => {
  if (!stripRef.value || !pdfService.value) return

  const container = stripRef.value
  const containerRect = container.getBoundingClientRect()

  const items = container.querySelectorAll<HTMLElement>('.thumbnail-item')
  const buffer = 2 // Render 2 items before and after visible area

  let firstVisible = -1
  let lastVisible = -1

  items.forEach((item, index) => {
    const itemRect = item.getBoundingClientRect()
    const isVisible = itemRect.right > containerRect.left && itemRect.left < containerRect.right

    if (isVisible) {
      if (firstVisible === -1) firstVisible = index
      lastVisible = index
    }
  })

  if (firstVisible === -1) return

  // Render visible thumbnails plus buffer
  const startPage = Math.max(1, firstVisible + 1 - buffer)
  const endPage = Math.min(props.pageCount, lastVisible + 1 + buffer)

  for (let page = startPage; page <= endPage; page++) {
    await renderThumbnail(page)
  }
}

// Handle horizontal scroll with mouse wheel
const onWheel = (e: WheelEvent) => {
  if (stripRef.value) {
    stripRef.value.scrollLeft += e.deltaY
    renderVisibleThumbnails()
  }
}

// Scroll to make current page visible
const scrollToCurrentPage = () => {
  if (!stripRef.value) return

  const item = stripRef.value.querySelector(`[data-page="${props.currentPage}"]`)
  if (item) {
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
}

// Load PDF and initialize
const loadPdf = async (url: string) => {
  if (!url) return

  // Dispose previous service
  if (pdfService.value) {
    pdfService.value.dispose()
  }

  renderedPages.value.clear()

  pdfService.value = new PdfService()
  try {
    await pdfService.value.loadDocument(url)
    await nextTick()
    await renderVisibleThumbnails()
  } catch (e) {
    console.error('Failed to load PDF for thumbnails:', e)
  }
}

// Watch URL changes
watch(() => props.url, (url) => {
  loadPdf(url)
}, { immediate: true })

// Watch current page changes to scroll into view
watch(() => props.currentPage, () => {
  scrollToCurrentPage()
})

// Add scroll listener for lazy loading
onMounted(() => {
  if (stripRef.value) {
    stripRef.value.addEventListener('scroll', renderVisibleThumbnails)
  }
})
</script>

<style scoped lang="scss">
.pdf-thumbnail-strip {
  display: flex;
  flex-direction: row;
  gap: 8px;
  padding: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;

  // Hide scrollbar but keep functionality
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.thumbnail-item {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &.active {
    background: rgba(var(--v-theme-primary), 0.3);
    outline: 2px solid rgb(var(--v-theme-primary));
  }
}

.thumbnail-canvas-wrapper {
  position: relative;
  width: v-bind('`${thumbnailWidth}px`');
  min-height: calc(v-bind('`${thumbnailWidth}px`') * 1.4);
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  overflow: hidden;
}

.thumbnail-canvas {
  display: block;
  width: 100%;
  height: auto;
}

.thumbnail-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(240, 240, 240, 0.9);
}

.page-number {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}
</style>
