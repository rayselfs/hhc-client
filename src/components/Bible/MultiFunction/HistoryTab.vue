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
        <div
          class="verse-item pa-3 d-flex align-center justify-space-between"
          :class="{
            selected: isSelected(item.id),
            focused: isFocused(item.id),
          }"
          @click.stop="handleItemClick(item.id, $event)"
          @dblclick="handleLoadVerse(item)"
          @contextmenu="handleRightClick($event, item)"
        >
          <div>
            <div class="text-h6 font-weight-medium d-flex">
              <span class="mr-1 text-no-wrap"
                >{{ item.bookAbbreviation }}{{ item.chapter }}:{{ item.verse }} -
              </span>
              <span class="text-justify">{{ item.verseText }}</span>
            </div>
          </div>
          <v-btn
            class="verse-btn"
            icon
            size="small"
            variant="text"
            @click.stop="handleRemoveItem(item.id)"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
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
const handleItemClick = (id: string, event: MouseEvent) => {
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
.verse-item {
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 4px;
  user-select: none;
}

.verse-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.verse-item.selected {
  background-color: rgba(var(--v-theme-primary), 0.2);
  border: 1px solid rgba(var(--v-theme-primary), 0.5);
}

.verse-item.focused {
  outline: 2px solid rgba(var(--v-theme-primary), 0.5);
  outline-offset: -2px;
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}
</style>
