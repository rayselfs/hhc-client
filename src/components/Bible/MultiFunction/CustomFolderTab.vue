<template>
  <div class="custom-content">
    <div class="custom-list">
      <div v-if="folders.length === 0 && verses.length === 0" class="text-center pa-4 text-grey">
        {{ $t('noCustomItems') }}
      </div>
      <div v-else>
        <!-- 資料夾列表 -->
        <div v-for="folder in folders" :key="folder.id" class="mb-2">
          <div
            class="verse-item pa-2 d-flex align-center justify-space-between"
            draggable="true"
            @dragstart="(e) => handleDragStart(e, 'folder', folder)"
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
          draggable="true"
          @dragstart="(e) => handleDragStart(e, 'verse', item)"
          @click="handleLoadVerse(item)"
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
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const { t: $t } = useI18n()

const {
  handleDragStart,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleDrop: handleDropBase,
} = useDragAndDrop<VerseItem>()

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
  emit('right-click', event, type, item)
}

const handleDrop = (event: DragEvent, targetFolder: Folder<VerseItem>) => {
  handleDropBase(event, (data, _container) => {
    emit('drop', data, targetFolder)
  })
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

.verse-item.drag-over {
  background-color: rgba(var(--v-theme-primary), 0.2) !important;
  border: 2px dashed rgba(var(--v-theme-primary), 0.5);
}

.verse-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.verse-item:hover .verse-btn {
  opacity: 1;
}
</style>
