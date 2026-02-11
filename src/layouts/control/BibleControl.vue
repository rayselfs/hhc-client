<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Preview -->
      <v-col
        :cols="mdAndUp ? 6 : 12"
        :class="['pl-4 pt-4 pb-4', mdAndUp ? 'pr-2 mb-0' : 'pr-4 mb-4']"
        :style="{ height: `${leftCardHeight}px` }"
      >
        <BiblePreview :height="leftCardHeight">
          <template #header>
            <ChapterNav :is-search-mode="isPreviewSearchMode" />
          </template>
        </BiblePreview>
      </v-col>

      <v-col
        :cols="mdAndUp ? 6 : 12"
        :class="['pt-4 pb-4 pr-4', mdAndUp ? 'pl-2' : 'pl-4']"
        ref="rightColumnContainer"
      >
        <v-row no-gutters class="fill-height">
          <!-- Multi Function Control -->
          <v-col cols="12" class="mb-4" :style="{ height: `${rightTopCardHeight}px` }">
            <MultiFunctionControl
              :container-height="rightTopCardHeight"
              @load-verse="loadVerseToPreview"
            />
          </v-col>

          <!-- Projection Control -->
          <v-col cols="12" :style="{ height: `${rightBottomCardHeight}px` }">
            <ProjectionControls :height="rightBottomCardHeight" ref="projectionControlsRef" />
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useBibleStore } from '@/stores/bible'
import { useCardLayout } from '@/composables/useLayout'
import { useBibleFolderStore } from '@/stores/folder'
import { BibleFolder } from '@/types/enum'
import { APP_CONFIG } from '@/config/app'
import type { VerseItem } from '@/types/folder'
import { useBible } from '@/composables/useBible'
import { storeToRefs } from 'pinia'

// Components
import MultiFunctionControl from '@/components/Bible/MultiFunction/Control.vue'
import BiblePreview from '@/components/Bible/BiblePreview.vue'
import ChapterNav from '@/components/Bible/ChapterNav.vue'
import ProjectionControls from '@/components/Bible/ProjectionControls.vue'

const bibleStore = useBibleStore()
const bibleFolderStore = useBibleFolderStore()
const { mdAndUp } = useDisplay()
const { currentPassage, previewBook, previewVerses, isMultiVersion, secondVersionCode } =
  storeToRefs(bibleStore)

const { leftCardHeight, rightTopCardHeight, rightBottomCardHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
  topCardRatio: 0.7,
})

const { updateProjection } = useBible(currentPassage, previewBook, previewVerses)

/**
 * Watch multi-version state changes to update projection immediately.
 * This logic ensures that when the user toggles multi-version mode or
 * changes the second version, the projection window stays in sync.
 */
watch([isMultiVersion, secondVersionCode], async ([newIsMulti, newSecondCode]) => {
  // Only update if we have a current passage and verse
  if (currentPassage.value && currentPassage.value.verse) {
    // If enabling multi-version, we need to make sure we have a second version code
    if (newIsMulti && !newSecondCode) {
      return
    }
    await updateProjection(currentPassage.value.verse)
  }
})

const projectionControlsRef = ref<InstanceType<typeof ProjectionControls> | null>(null)
const isPreviewSearchMode = ref(false)

// Handle verse loading from multi-function control
const loadVerseToPreview = async (item: VerseItem, type: 'history' | 'custom') => {
  isPreviewSearchMode.value = false
  bibleStore.setSelectedVerse(item.bookNumber, item.chapter, item.verse)

  if (type === 'custom') {
    await updateProjection(item.verse)
  }
}

onMounted(async () => {
  await bibleFolderStore.loadRootFolder()
  await bibleFolderStore.loadChildren(BibleFolder.ROOT_ID)
})

onUnmounted(() => {
  // Any necessary cleanup
})

import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

// Keyboard shortcuts for projection navigation
useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.BIBLE.PREV_VERSE,
    handler: () => {
      projectionControlsRef.value?.goToPreviousVerseProjection()
    },
  },
  {
    config: KEYBOARD_SHORTCUTS.BIBLE.NEXT_VERSE,
    handler: () => {
      projectionControlsRef.value?.goToNextVerseProjection()
    },
  },
])
</script>

<style scoped></style>

<style scoped>
.bible-content-wrapper {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.bible-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
}

.bible-content {
  line-height: 1.8;
}

.verse-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.verse-number {
  min-width: 20px;
  text-align: right;
}

.history-verse-number {
  min-width: 80px;
}

.verse-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 8px;
}

.verse-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.5);
}

.verse-highlighted {
  background-color: rgba(var(--v-theme-primary), 0.4);
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}

.verse-content {
  flex: 1;
}

.search-verse-reference {
  white-space: nowrap;
  flex-shrink: 0;
}

.search-highlight {
  color: rgb(var(--v-theme-error, 255, 82, 82));
  background-color: rgba(var(--v-theme-error), 0.1);
  padding: 2px 4px;
  border-radius: 2px;
}
</style>
