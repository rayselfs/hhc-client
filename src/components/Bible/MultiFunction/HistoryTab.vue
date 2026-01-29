<template>
  <div
    ref="containerRef"
    class="history-content"
    style="height: 100%"
    @click="handleBackgroundClick"
  >
    <div v-if="historyVerses.length === 0" class="text-center pa-4 text-grey">
      {{ $t('bible.noHistory') }}
    </div>
    <v-virtual-scroll
      v-else
      :items="historyVerses"
      :height="containerHeight ? `${containerHeight - 48}px` : 'calc(100% - 48px)'"
      :item-height="80"
    >
      <template #default="{ item }">
        <v-list-item
          padding="pa-3"
          rounded="rounded"
          :selected="isSelected(item.id)"
          :focused="isFocused(item.id)"
          :selected-opacity="0.2"
          :hover-opacity="0.1"
          class="mb-1"
          @click="handleItemClick(item.id, $event)"
          @dblclick="handleLoadVerse(item)"
          @contextmenu="handleRightClick($event, item)"
        >
          <div class="text-h6 font-weight-medium d-flex">
            <span class="mr-1 text-no-wrap"
              >{{ item.bookAbbreviation }}{{ item.chapter }}:{{ item.verse }} -
            </span>
            <span class="text-justify">{{ item.verseText }}</span>
          </div>

          <template #append>
            <v-btn icon size="small" variant="text" @click.stop="handleRemoveItem(item.id)">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </template>
    </v-virtual-scroll>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { VerseItem, ClipboardItem } from '@/types/common'
import { useSelectionManager } from '@/composables/useSelectionManager'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

interface Props {
  historyVerses: VerseItem[]
  containerHeight?: number
}

interface Emits {
  (e: 'load-verse', item: VerseItem): void
  (e: 'remove-item', id: string): void
  (e: 'right-click', event: MouseEvent, item: VerseItem): void
  (e: 'selection-change', selection: Set<string>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t: $t } = useI18n()

import { useBibleFolderStore } from '@/stores/folder'
const folderStore = useBibleFolderStore()
const { copyToClipboard } = folderStore

const { selectedItems, focusedId, handleItemClick: handleSelectionClick } = useSelectionManager()

import { watch } from 'vue'

watch(
  () => selectedItems.value,
  (newSelection) => {
    emit('selection-change', new Set(newSelection))
  },
  { deep: true },
)

const containerRef = ref<HTMLElement | null>(null)

onClickOutside(
  containerRef,
  () => {
    selectedItems.value.clear()
    focusedId.value = null
  },
  {
    ignore: ['.v-overlay-container', '.v-menu__content'],
  },
)

// Handle Item Click (Selection)
const handleItemClick = (id: string, event: MouseEvent | KeyboardEvent) => {
  handleSelectionClick(
    id,
    props.historyVerses.map((v) => ({ id: v.id })),
    event,
  )
}

const isSelected = (id: string) => selectedItems.value.has(id)
const isFocused = (id: string) => focusedId.value === id

// Background Click
const handleBackgroundClick = () => {
  // Always clear selection for background click
  // Items stop propagation, so this only runs for actual background clicks
  selectedItems.value.clear()
  focusedId.value = null
}

// Copy Logic
const copySelectedItems = () => {
  if (selectedItems.value.size === 0) return

  const itemsToCopy: ClipboardItem<VerseItem>[] = []

  props.historyVerses.forEach((verse) => {
    if (selectedItems.value.has(verse.id)) {
      itemsToCopy.push({
        type: 'verse',
        data: verse,
        action: 'copy',
        sourceFolderId: 'history', // Special ID for history
      })
    }
  })

  if (itemsToCopy.length > 0) {
    copyToClipboard(itemsToCopy)
  }
}

const deleteSelectedItems = () => {
  if (selectedItems.value.size === 0) return

  selectedItems.value.forEach((id) => {
    emit('remove-item', id)
  })
  selectedItems.value.clear()
}

const clearSelection = () => {
  selectedItems.value.clear()
  focusedId.value = null
}

defineExpose({
  copySelectedItems,
  deleteSelectedItems,
  clearSelection,
})

// Keyboard Shortcuts
useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.EDIT.COPY,
    handler: copySelectedItems,
  },
])

const handleLoadVerse = (item: VerseItem) => {
  emit('load-verse', item)
}

const handleRemoveItem = (id: string) => {
  emit('remove-item', id)
}

const handleRightClick = (event: MouseEvent, item: VerseItem) => {
  if (!selectedItems.value.has(item.id)) {
    handleItemClick(item.id, event)
  }
  emit('right-click', event, item)
}
</script>

<style scoped>
/* No custom styles needed - LiquidListItem handles all hover/selection states */
</style>
