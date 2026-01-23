<template>
  <div
    v-if="!pdfStore.showSidebar"
    class="pdf-controls-container d-flex flex-column justify-center position-relative"
  >
    <div class="controls-bar d-flex align-center ga-1 px-4 py-2 rounded-pill align-self-start">
      <v-btn
        icon
        variant="text"
        size="small"
        class="control-btn"
        color="white"
        :disabled="!pdfStore.canGoPrev"
        @click="pdfStore.prevPage()"
      >
        <v-icon>mdi-chevron-left</v-icon>
      </v-btn>

      <v-chip
        class="page-indicator mx-1"
        variant="tonal"
        size="small"
        @click="pdfStore.toggleSidebar()"
      >
        {{ pdfStore.currentPage }} / {{ pdfStore.pageCount }}
      </v-chip>

      <v-btn
        icon
        variant="text"
        size="small"
        class="control-btn"
        color="white"
        :disabled="!pdfStore.canGoNext"
        @click="pdfStore.nextPage()"
      >
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>

      <v-divider vertical class="mx-2" style="border-color: rgba(255, 255, 255, 0.2)" />

      <v-btn-toggle
        :model-value="pdfStore.viewMode"
        mandatory
        density="compact"
        class="view-mode-toggle"
        @update:model-value="handleViewModeChange"
      >
        <v-btn value="slide" size="small" :title="$t('media.pdf.slideMode')" variant="text">
          <v-icon size="18" color="white">mdi-presentation</v-icon>
        </v-btn>
        <v-btn value="scroll" size="small" :title="$t('media.pdf.scrollMode')" variant="text">
          <v-icon size="18" color="white">mdi-script-text</v-icon>
        </v-btn>
      </v-btn-toggle>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePdfPresenterStore } from '@/stores/pdfPresenter'
import type { PdfViewMode } from '@/composables/usePdf'

const pdfStore = usePdfPresenterStore()

const emit = defineEmits<{
  (e: 'viewModeChange', mode: PdfViewMode): void
}>()

const handleViewModeChange = (mode: PdfViewMode) => {
  pdfStore.setViewMode(mode)
  emit('viewModeChange', mode)
}
</script>

<style scoped lang="scss">
.pdf-controls-container {
  width: auto;
}

.control-btn {
  font-size: 1.2rem;
}

.controls-bar {
  background: rgba(20, 20, 20, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.3);
}

.page-indicator {
  cursor: pointer;
  min-width: 60px;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

.view-mode-toggle {
  background: transparent;
  border: none;

  :deep(.v-btn) {
    background: transparent !important;
    border: none !important;
    opacity: 0.7;

    &.v-btn--active {
      opacity: 1;
      background: rgba(255, 255, 255, 0.15) !important;
    }
  }
}
</style>
