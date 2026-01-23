<template>
  <div
    v-if="!pdfStore.showSidebar"
    class="pdf-controls-container d-flex flex-column justify-center position-relative"
  >
    <liquid-container
      class="controls-bar d-flex align-center ga-1 align-self-start"
      mode="advanced"
      padding="pa-1"
    >
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

      <LiquidBtnToggle
        :model-value="pdfStore.viewMode"
        :items="[
          {
            value: 'slide',
            icon: 'mdi-presentation',
            title: $t('media.pdf.slideMode'),
          },
          {
            value: 'scroll',
            icon: 'mdi-script-text',
            title: $t('media.pdf.scrollMode'),
          },
        ]"
        mandatory
        density="compact"
        rounded="rounded-xl"
        mode="advanced"
        size="x-large"
        ghost
        @update:model-value="handleViewModeChange"
      />
    </liquid-container>
  </div>
</template>

<script setup lang="ts">
import { usePdfPresenterStore } from '@/stores/pdfPresenter'
import type { PdfViewMode } from '@/composables/usePdf'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
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
</style>
