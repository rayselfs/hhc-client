<template>
  <liquid-container
    v-if="pdfStore.showSidebar"
    class="pdf-thumbnail-sidebar"
    mode="advanced"
    rounded="rounded-0"
    padding="pa-0"
  >
    <div class="d-flex flex-column h-100">
      <div class="sidebar-header d-flex align-center justify-space-between px-3 py-2">
        <span class="text-subtitle-2 text-white">{{ $t('media.pdf.pages') }}</span>
        <v-btn icon variant="text" size="x-small" color="white" @click="pdfStore.closeSidebar()">
          <v-icon size="18">mdi-close</v-icon>
        </v-btn>
      </div>

      <div ref="scrollContainer" class="thumbnail-list">
        <div
          v-for="page in pdfStore.pageCount"
          :key="page"
          class="thumbnail-item"
          :class="{ active: page === pdfStore.currentPage }"
          @click="handlePageClick(page)"
        >
          <div class="thumbnail-wrapper position-relative">
            <img
              v-if="thumbnails.get(page)"
              :src="thumbnails.get(page)"
              class="thumbnail-image"
              :alt="`Page ${page}`"
            />
            <div v-else class="thumbnail-placeholder d-flex align-center justify-center">
              <v-progress-circular
                v-if="loadingPages.has(page)"
                indeterminate
                size="20"
                width="2"
                color="white"
              />
              <v-icon v-else size="24" color="grey">mdi-file-document-outline</v-icon>
            </div>

            <div class="page-badge">{{ page }}</div>
          </div>
        </div>
      </div>
    </div>
  </liquid-container>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { usePdfPresenterStore } from '@/stores/pdfPresenter'
import { useSentry } from '@/composables/useSentry'

const { reportError } = useSentry()
const pdfStore = usePdfPresenterStore()

const scrollContainer = ref<HTMLElement | null>(null)
const thumbnails = ref<Map<number, string>>(new Map())
const loadingPages = ref<Set<number>>(new Set())

const THUMBNAIL_WIDTH = 140

const handlePageClick = (page: number) => {
  pdfStore.setPage(page)
}

const generateThumbnail = async (page: number) => {
  if (!pdfStore.pdfService || thumbnails.value.has(page) || loadingPages.value.has(page)) {
    return
  }

  loadingPages.value.add(page)

  try {
    const blob = await pdfStore.pdfService.generateThumbnail(page, THUMBNAIL_WIDTH)
    if (blob) {
      const url = URL.createObjectURL(blob)
      thumbnails.value.set(page, url)
    }
  } catch (error) {
    reportError(error, {
      operation: 'generate-thumbnail',
      component: 'PdfSidebar',
      extra: { page },
    })
  } finally {
    loadingPages.value.delete(page)
  }
}

const setupLazyLoading = (): IntersectionObserver | null => {
  if (!scrollContainer.value) return null

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageStr = (entry.target as HTMLElement).dataset.page
          if (pageStr) {
            const page = parseInt(pageStr, 10)
            generateThumbnail(page)
          }
        }
      })
    },
    {
      root: scrollContainer.value,
      rootMargin: '100px',
      threshold: 0,
    },
  )

  nextTick(() => {
    const items = scrollContainer.value?.querySelectorAll('.thumbnail-item')
    items?.forEach((item, index) => {
      ;(item as HTMLElement).dataset.page = String(index + 1)
      observer.observe(item)
    })
  })

  return observer
}

let observer: IntersectionObserver | null = null

watch(
  () => pdfStore.showSidebar,
  (isOpen) => {
    if (isOpen) {
      nextTick(() => {
        observer = setupLazyLoading()
        scrollToCurrentPage()
      })
    } else {
      observer?.disconnect()
      observer = null
    }
  },
)

watch(
  () => pdfStore.currentPage,
  () => {
    if (pdfStore.showSidebar) {
      scrollToCurrentPage()
    }
  },
)

const scrollToCurrentPage = () => {
  nextTick(() => {
    const activeItem = scrollContainer.value?.querySelector('.thumbnail-item.active')
    activeItem?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

watch(
  () => pdfStore.pdfService,
  () => {
    thumbnails.value.forEach((url) => URL.revokeObjectURL(url))
    thumbnails.value.clear()
    loadingPages.value.clear()
  },
)

onMounted(() => {
  if (pdfStore.showSidebar) {
    nextTick(() => {
      observer = setupLazyLoading()
    })
  }
})
</script>

<style scoped lang="scss">
.pdf-thumbnail-sidebar {
  position: absolute !important;
  top: 0;
  left: 0;
  bottom: 0;
  width: 180px;
  z-index: 15;
}

.pdf-thumbnail-sidebar :deep(.liquid-glass-content) {
  height: 100%;
}

.sidebar-header {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.2);
}

.thumbnail-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
}

.thumbnail-item {
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  &.active {
    border-color: #2196f3;
    box-shadow: 0 0 8px rgba(33, 150, 243, 0.4);
  }
}

.thumbnail-wrapper {
  aspect-ratio: 3/4;
  background: rgba(255, 255, 255, 0.05);
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.03);
}

.page-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}
</style>
