<template>
  <div ref="containerRef" class="custom-content" @click="handleBackgroundClick">
    <div class="custom-list">
      <div v-if="folders.length === 0 && verses.length === 0" class="text-center pa-4 text-grey">
        {{ $t('common.noCustomItems') }}
      </div>
      <div v-else>
        <!-- 資料夾列表 -->
        <div v-for="folder in folders" :key="folder.id" class="mb-2">
          <div
            class="verse-item pa-2 d-flex align-center justify-space-between"
            :class="{
              selected: isSelected(folder.id),
              focused: isFocused(folder.id),
            }"
            draggable="true"
            @click.stop="handleItemClick(folder.id, $event)"
            @dragstart="(e) => handleDragStart(e, 'folder', folder)"
            @dragend="handleDragEnd"
            @dragover="handleDragOver"
            @dragenter="handleDragEnter"
            @dragleave="handleDragLeave"
            @drop="(e) => handleDrop(e, folder)"
            @dblclick="handleEnterFolder(folder.id)"
            @contextmenu="handleRightClick($event, 'folder', folder)"
          >
            <div class="d-flex align-center text-subtitle-1">
              <v-icon class="mr-2">mdi-folder</v-icon>
              <span>{{ folder.name }}</span>
            </div>
            <v-btn
              class="verse-btn"
              icon
              size="small"
              variant="text"
              @click.stop="handleDeleteFolder(folder.id)"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>
        </div>

        <!-- 經文列表 -->
        <div
          v-for="item in verses"
          :key="item.id"
          class="verse-item pa-2 mb-1 d-flex align-center justify-space-between"
          :class="{
            selected: isSelected(item.id),
            focused: isFocused(item.id),
          }"
          draggable="true"
          @click.stop="handleItemClick(item.id, $event)"
          @dragstart="(e) => handleDragStart(e, 'verse', item)"
          @dragend="handleDragEnd"
          @dblclick="handleLoadVerse(item)"
          @contextmenu="handleRightClick($event, 'verse', item)"
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
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VerseItem, Folder } from '@/types/common'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import type { DragData } from '@/utils/typeGuards'

interface Props {
  folders: Folder<VerseItem>[]
  verses: VerseItem[]
}

interface Emits {
  (e: 'load-verse', item: VerseItem): void
  (e: 'remove-item', id: string): void
  (e: 'enter-folder', folderId: string): void
  (e: 'delete-folder', folderId: string): void
  (e: 'drop', data: DragData<VerseItem>, target: Folder<VerseItem>): void
  (
    e: 'right-click',
    event: MouseEvent,
    type: 'verse' | 'folder',
    item: VerseItem | Folder<VerseItem>,
  ): void
  (e: 'paste'): void
  (e: 'selection-change', selection: Set<string>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t: $t } = useI18n()

const {
  handleDragStart,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDragEnd,
  handleDrop: handleDropBase,
} = useDragAndDrop<VerseItem>()

import { useSelectionManager } from '@/composables/useSelectionManager'
import { useBibleFolderStore } from '@/stores/folder'
import { BibleFolder } from '@/types/enum'
import type { ClipboardItem } from '@/types/common'
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'

const folderStore = useBibleFolderStore()
const { copyToClipboard, cutToClipboard } = folderStore

// Selection Manager
const {
  selectedItems,
  focusedId,
  handleItemClick: handleSelectionClick,
  selectAll,
} = useSelectionManager()

// Merged Items for selection/navigation (Folders + Verses)
const mergedItems = computed(() => [
  ...props.folders.map((f) => ({ id: f.id })),
  ...props.verses.map((v) => ({ id: v.id })),
])

// Handle Click (Selection)
const handleItemClick = (id: string, event: MouseEvent) => {
  handleSelectionClick(id, mergedItems.value, event)
}

// Watch selection changes and emit to parent
import { watch } from 'vue'
watch(
  () => selectedItems.value,
  (newSelection) => {
    emit('selection-change', new Set(newSelection))
  },
  { deep: true },
)

import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

// Copy Logic
const copySelectedItems = () => {
  if (selectedItems.value.size === 0) return

  const itemsToCopy: ClipboardItem<VerseItem>[] = []

  // Find selected folders
  props.folders.forEach((folder) => {
    if (selectedItems.value.has(folder.id)) {
      itemsToCopy.push({
        type: 'folder',
        data: folder,
        action: 'copy',
        sourceFolderId: folder.parentId || BibleFolder.ROOT_ID, // Fallback
      })
    }
  })

  // Find selected verses
  props.verses.forEach((verse) => {
    if (selectedItems.value.has(verse.id)) {
      itemsToCopy.push({
        type: 'verse',
        data: verse,
        action: 'copy',
        sourceFolderId: verse.folderId || BibleFolder.ROOT_ID, // Fallback
      })
    }
  })

  if (itemsToCopy.length > 0) {
    copyToClipboard(itemsToCopy)
  }
}

// Cut Logic
const cutSelectedItems = () => {
  if (selectedItems.value.size === 0) return

  const itemsToCut: ClipboardItem<VerseItem>[] = []

  // Find selected folders
  props.folders.forEach((folder) => {
    if (selectedItems.value.has(folder.id)) {
      itemsToCut.push({
        type: 'folder',
        data: folder,
        action: 'cut',
        sourceFolderId: folder.parentId || BibleFolder.ROOT_ID,
      })
    }
  })

  // Find selected verses
  props.verses.forEach((verse) => {
    if (selectedItems.value.has(verse.id)) {
      itemsToCut.push({
        type: 'verse',
        data: verse,
        action: 'cut',
        sourceFolderId: verse.folderId || BibleFolder.ROOT_ID,
      })
    }
  })

  if (itemsToCut.length > 0) {
    cutToClipboard(itemsToCut)
  }
}

const deleteSelectedItems = () => {
  if (selectedItems.value.size === 0) return

  // Iterate to delete items one by one as per current API capability
  selectedItems.value.forEach((id) => {
    const folder = props.folders.find((f) => f.id === id)
    if (folder) {
      emit('delete-folder', id)
      return
    }
    const verse = props.verses.find((v) => v.id === id)
    if (verse) {
      emit('remove-item', id)
    }
  })
}

const containerRef = ref<HTMLElement | null>(null)

onClickOutside(
  containerRef,
  () => {
    selectedItems.value.clear()
    focusedId.value = null
  },
  {
    ignore: ['.v-overlay-container', '.v-menu__content', '.ignore-selection-clear'],
  },
)

// Background Click
const handleBackgroundClick = () => {
  // Always clear selection for background click
  // Items stop propagation, so this only runs for actual background clicks
  selectedItems.value.clear()
  focusedId.value = null
}

// Keyboard Shortcuts
useKeyboardShortcuts([
  {
    config: KEYBOARD_SHORTCUTS.EDIT.SELECT_ALL,
    handler: () => selectAll(mergedItems.value.map((i) => i.id)),
  },
  {
    config: KEYBOARD_SHORTCUTS.EDIT.COPY,
    handler: copySelectedItems,
  },
  {
    config: KEYBOARD_SHORTCUTS.EDIT.CUT,
    handler: cutSelectedItems,
  },
  {
    config: KEYBOARD_SHORTCUTS.EDIT.DELETE,
    handler: deleteSelectedItems,
  },
])

// Check selection
const isSelected = (id: string) => selectedItems.value.has(id)
const isFocused = (id: string) => focusedId.value === id

const handleLoadVerse = (item: VerseItem) => {
  emit('load-verse', item)
}

const handleRemoveItem = (id: string) => {
  emit('remove-item', id)
}

const handleEnterFolder = (folderId: string) => {
  emit('enter-folder', folderId)
  // Clear text selection to prevent folder name highlighting
  if (window.getSelection) {
    window.getSelection()?.removeAllRanges()
  }
}

const handleDeleteFolder = (folderId: string) => {
  emit('delete-folder', folderId)
}

const handleRightClick = (
  event: MouseEvent,
  type: 'verse' | 'folder',
  item: VerseItem | Folder<VerseItem>,
) => {
  // If not selected, select it
  if (!selectedItems.value.has(item.id)) {
    handleItemClick(item.id, event)
  }
  emit('right-click', event, type, item)
}

const handleDrop = (event: DragEvent, targetFolder: Folder<VerseItem>) => {
  handleDropBase(event, (data) => {
    emit('drop', data, targetFolder)
  })
}
</script>

<style scoped>
.custom-list {
  min-height: 100%; /* Ensure clicking anywhere fills height */
}

.verse-item {
  cursor: pointer;
  transition: background-color 0.1s ease;
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

.verse-item.drag-over {
  background-color: rgba(var(--v-theme-primary), 0.2) !important;
  border: 2px dashed rgba(var(--v-theme-primary), 0.5);
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.1s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}
</style>
