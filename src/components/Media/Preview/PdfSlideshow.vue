<template>
  <div class="pdf-slideshow position-relative w-100 h-100 d-flex align-center justify-center">
    <!-- PDF Sidebar (uses pdfStore internally) -->
    <PdfSidebar />

    <!-- PDF Viewer (canvas-based) -->
    <PdfViewer
      v-if="item"
      ref="pdfViewerRef"
      :url="item.url"
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

    <!-- Drag Overlay for PDF (To capture mouse events over iframe/canvas) -->
    <div
      v-if="showZoomControls"
      class="position-absolute w-100 h-100 top-0 left-0"
      style="z-index: 5; cursor: grab"
      @mousedown="$emit('start-drag', $event)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { usePdfPresenterStore } from '@/stores/pdfPresenter'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { MessageType } from '@/types/common'
import type { FileItem } from '@/types/common'
import type { PdfViewMode } from '@/composables/usePdf'
import PdfViewer from '@/components/Media/PdfViewer.vue'
import PdfPresenterControls from '@/components/Media/PdfPresenterControls.vue'
import PdfSidebar from '@/components/Media/PdfSidebar.vue'

interface Props {
  item: FileItem | null | undefined
  showZoomControls: boolean
}

const props = defineProps<Props>()
defineEmits<{
  (e: 'start-drag', event: MouseEvent): void
}>()

const store = useMediaProjectionStore()
const pdfStore = usePdfPresenterStore()
const { zoomLevel, pan, pdfPage } = storeToRefs(store)
const { sendProjectionMessage } = useProjectionManager()

const pdfViewerRef = ref<InstanceType<typeof PdfViewer> | null>(null)

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

// Sync with projection
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

// Reset on item change
watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      pdfStore.reset()
    }
  },
)
</script>
