<template>
  <div
    ref="mediaItemContainerRef"
    class="media-item-list-container"
    :style="{ height: `${mediaSpaceHeight}px` }"
    tabindex="0"
    @keydown="onKeyDown"
    @mousedown="onSelectionMouseDown"
    @contextmenu.prevent="openBackgroundContextMenu"
  >
    <MediaGrid
      :items="items"
      :local-items="localItems"
      :use-virtual-scroll="useVirtualScroll"
      :chunked-items="chunkedItems"
    >
      <template #item="{ item, isVirtual }">
        <MediaListItem
          :item="item"
          :is-selected="selectedItems.has(item.id)"
          :is-focused="focusedId === item.id"
          :is-cut="isCut(item.id)"
          :is-dragging="draggedItems.has(item.id)"
          :draggable="canDrag(item)"
          :size="props.itemSize"
          :is-virtual="isVirtual"
          @dragstart="onDragStart($event, item)"
          @dragend="onDragEnd"
          @drop="onDrop($event, item)"
          @dragover="onDragOver($event, item)"
          @dragenter="onDragEnter($event)"
          @dragleave="onDragLeave($event)"
          @click="handleItemClick(item.id, $event)"
          @dblclick="handleDoubleClick(item)"
          @contextmenu="openContextMenu(item, $event)"
        />
      </template>
    </MediaGrid>

    <div
      v-if="selectionBox"
      class="selection-box border-primary border"
      :style="{ ...selectionBox, backgroundColor: 'rgba(var(--v-theme-primary), 0.1)' }"
    ></div>

    <MediaToolbar
      v-model="showContextMenu"
      :activator="menuActivator"
      :position="menuPosition"
      :context-menu-target="contextMenuTarget"
      :clipboard="clipboard"
      :selected-items="selectedItems"
      @edit="(target) => emit('edit', target)"
      @copy="emit('copy')"
      @cut="emit('cut')"
      @delete="emit('delete')"
      @paste-into-folder="(id) => emit('paste-into-folder', id)"
      @create-folder="emit('create-folder')"
      @upload-file="emit('upload-file')"
      @upload-folder="emit('upload-folder')"
      @paste="emit('paste')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FileItem, Folder, ClipboardItem } from '@/types/folder'
import { MediaFolder } from '@/types/enum'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useMediaFolderStore } from '@/stores/folder'
import { useSnackBar } from '@/composables/useSnackBar'
import { useDragSelection } from '@/composables/useDragSelection'
import { useSelectionManager } from '@/composables/useSelectionManager'
import { useElementSize } from '@vueuse/core'
import MediaGrid from './MediaGrid.vue'
import MediaListItem from './MediaListItem.vue'
import MediaToolbar from './MediaToolbar.vue'

type UnifiedItem = FileItem | Folder<FileItem>

const props = withDefaults(
  defineProps<{
    items: UnifiedItem[]
    selectedItems: Set<string>
    clipboard: ClipboardItem<FileItem>[]
    mediaSpaceHeight: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    itemSize?: number
  }>(),
  { itemSize: 140 },
)

const emit = defineEmits<{
  (e: 'update:selected-items', selected: Set<string>): void
  (e: 'drag-start', event: DragEvent, item: UnifiedItem): void
  (e: 'drag-end', event: DragEvent): void
  (e: 'sort-change', mode: 'custom'): void
  (e: 'edit', target: UnifiedItem): void
  (e: 'copy'): void
  (e: 'cut'): void
  (e: 'delete'): void
  (e: 'paste'): void
  (e: 'create-folder'): void
  (e: 'upload-file'): void
  (e: 'upload-folder'): void
  (e: 'paste-into-folder', folderId: string): void
  (e: 'open-presentation', item: FileItem): void
}>()

const { t } = useI18n()
const { showSnackBar } = useSnackBar()
const mediaStore = useMediaFolderStore()
const { getSelectionMode, handleKeyNavigation, focusedId, scrollIntoView } = useSelectionManager()

const VIRTUAL_SCROLL_THRESHOLD = 50
const isFolder = (item: UnifiedItem): item is Folder<FileItem> => 'items' in item
const localItems = ref<UnifiedItem[]>([])
const dropSucceeded = ref(false)

const {
  handleDragStart,
  handleDragEnd,
  handleDrop,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  draggedItems,
} = useDragAndDrop<FileItem>({ itemSelector: '.media-item-wrapper' })

watch(
  () => props.items,
  (newVal) => {
    if (draggedItems.value.size === 0) localItems.value = [...newVal]
  },
  { immediate: true },
)

const mediaSpaceHeight = computed(() => props.mediaSpaceHeight - 50)
const useVirtualScroll = computed(() => props.items.length > VIRTUAL_SCROLL_THRESHOLD)
const lastSelectedId = ref<string | null>(null)
const handleItemClick = (id: string, event: MouseEvent) => {
  focusedId.value = id
  updateSelection(id, getSelectionMode(event))
}

const onKeyDown = (event: KeyboardEvent) => {
  const currentItems = localItems.value.length > 0 ? localItems.value : props.items
  const newFocusedId = handleKeyNavigation(
    event,
    currentItems as { id: string }[],
    colsPerRow.value,
  )

  if (newFocusedId) {
    scrollIntoView(mediaItemContainerRef.value as HTMLElement)
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) updateSelection(newFocusedId, 'single')
    else if (event.shiftKey && !event.ctrlKey && !event.metaKey)
      updateSelection(newFocusedId, 'range')
  }

  if (event.code === 'Space') {
    event.preventDefault()
    if (focusedId.value) {
      const mode = getSelectionMode(event)
      updateSelection(
        focusedId.value,
        mode === 'range-add' ? 'range-add' : event.ctrlKey || event.metaKey ? 'multi' : 'single',
      )
    }
  }

  if (event.code === 'Enter' && focusedId.value) {
    const item = props.items.find((i) => i.id === focusedId.value)
    if (item) {
      if (isFolder(item)) {
        mediaStore.enterFolder(item.id)
        emit('update:selected-items', new Set())
        mediaStore.loadChildren(item.id)
        focusedId.value = null
      } else {
        const fileItem = item as FileItem
        if (fileItem.permissions?.canPresent === false) {
          showSnackBar(t('fileExplorer.ffmpegRequired'), { color: 'warning' })
        } else {
          emit('open-presentation', fileItem)
        }
      }
    }
  }
}

const updateSelection = (targetId: string, mode: 'single' | 'multi' | 'range' | 'range-add') => {
  const newSelection = new Set(props.selectedItems)
  const allIds = props.items.map((i) => i.id)

  if (mode === 'range' || mode === 'range-add') {
    if (lastSelectedId.value) {
      const start = allIds.indexOf(lastSelectedId.value)
      const end = allIds.indexOf(targetId)
      if (start !== -1 && end !== -1) {
        if (mode === 'range') newSelection.clear()
        const [lower, upper] = [Math.min(start, end), Math.max(start, end)]
        allIds.slice(lower, upper + 1).forEach((rid) => newSelection.add(rid))
      }
    }
  } else if (mode === 'multi') {
    if (newSelection.has(targetId)) newSelection.delete(targetId)
    else {
      newSelection.add(targetId)
      lastSelectedId.value = targetId
    }
  } else {
    if (newSelection.size === 1 && newSelection.has(targetId)) return
    newSelection.clear()
    newSelection.add(targetId)
    lastSelectedId.value = targetId
  }
  emit('update:selected-items', newSelection)
}

const mediaItemContainerRef = ref<HTMLElement | null>(null)
const selectedItemsWritable = computed({
  get: () => props.selectedItems,
  set: (val) => emit('update:selected-items', val),
})

const {
  selectionBox,
  onMouseDown: onSelectionMouseDown,
  isDragging: isSelectionDragging,
} = useDragSelection({
  containerRef: mediaItemContainerRef,
  selectedIds: selectedItemsWritable,
})

const onDragEnter = (event: DragEvent) => handleDragEnter(event)
const onDragLeave = (event: DragEvent) => handleDragLeave(event)
const canDrag = (item: UnifiedItem) => (item.permissions || DEFAULT_LOCAL_PERMISSIONS).canMove

const onDragStart = (event: DragEvent, item: UnifiedItem) => {
  if (!canDrag(item)) return
  handleDragStart(event, isFolder(item) ? 'folder' : 'file', item, props.selectedItems, () =>
    props.items.filter((i) => props.selectedItems.has(i.id)),
  )
  emit('drag-start', event, item)
}

const onDragOver = (event: DragEvent, targetItem: UnifiedItem) => {
  handleDragOver(event)
  if (useVirtualScroll.value || props.sortBy !== 'custom') return
  if (isFolder(targetItem)) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    if (percent > 0.2 && percent < 0.8) return
  }

  const draggedId = Array.from(draggedItems.value)[0]
  if (!draggedId || draggedId === targetItem.id) return

  const draggedIndex = localItems.value.findIndex((i) => i.id === draggedId)
  const targetIndex = localItems.value.findIndex((i) => i.id === targetItem.id)
  if (draggedIndex !== -1 && targetIndex !== -1) {
    const items = [...localItems.value]
    const [draggedItem] = items.splice(draggedIndex, 1)
    if (draggedItem) {
      items.splice(targetIndex, 0, draggedItem)
      localItems.value = items
    }
  }
}

const onDragEnd = (event: DragEvent) => {
  handleDragEnd()
  emit('drag-end', event)
  if (!dropSucceeded.value) localItems.value = [...props.items]
  dropSucceeded.value = false
}

const onDrop = async (event: DragEvent, item: UnifiedItem) => {
  let isNesting = false
  if (isFolder(item)) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    if (percent > 0.2 && percent < 0.8) isNesting = true
  }

  if (isNesting && isFolder(item)) {
    const dataString = event.dataTransfer?.getData('application/json')
    if (dataString) {
      try {
        const parsed = JSON.parse(dataString)
        const itemsToMove = parsed.items as (FileItem | Folder<FileItem>)[]
        const type = parsed.type as string
        for (const itm of itemsToMove) {
          if (type === 'file') {
            const file = props.items.find((i) => i.id === itm.id) as FileItem
            if (file && !('items' in file)) {
              mediaStore.moveItem(
                file,
                item.id,
                mediaStore.currentFolder?.id || MediaFolder.ROOT_ID,
              )
            }
          } else {
            const folder = props.items.find((f) => f.id === itm.id) as Folder<FileItem>
            if (folder && 'items' in folder) {
              await mediaStore.moveFolder(
                folder,
                item.id,
                mediaStore.currentFolder?.id || MediaFolder.ROOT_ID,
              )
            }
          }
        }
        showSnackBar(t('fileExplorer.moveSuccess'), { color: 'success' })
      } catch {
        /* ignore */
      }
    }
    handleDrop(event, () => {})
  } else {
    const newFolders = localItems.value.filter(isFolder) as Folder<FileItem>[]
    const newFiles = localItems.value.filter((i) => !isFolder(i)) as FileItem[]
    await mediaStore.reorderCurrentFolders(newFolders)
    await mediaStore.reorderCurrentItems(newFiles)
    emit('sort-change', 'custom')
    dropSucceeded.value = true
    handleDrop(event, () => {})
  }
}
const handleDoubleClick = (item: UnifiedItem) => {
  if (isFolder(item)) {
    mediaStore.enterFolder(item.id)
    emit('update:selected-items', new Set())
    mediaStore.loadChildren(item.id)
  } else {
    const fileItem = item as FileItem
    if (fileItem.permissions?.canPresent === false) {
      showSnackBar(t('fileExplorer.ffmpegRequired'), { color: 'warning' })
    } else {
      emit('open-presentation', fileItem)
    }
  }
}

const contextMenuTarget = ref<UnifiedItem | null>(null)
const showContextMenu = ref(false)
const menuActivator = ref<HTMLElement | undefined>(undefined)
const menuPosition = ref<[number, number] | undefined>(undefined)

const openBackgroundContextMenu = (event: MouseEvent) => {
  if (isSelectionDragging.value) return
  event.preventDefault()
  emit('update:selected-items', new Set())
  menuPosition.value = [event.clientX, event.clientY]
  menuActivator.value = undefined
  contextMenuTarget.value = null
  showContextMenu.value = true
}

const openContextMenu = (item: UnifiedItem, event: MouseEvent) => {
  event.preventDefault()
  if (!props.selectedItems.has(item.id)) handleItemClick(item.id, event)
  contextMenuTarget.value = item
  menuActivator.value = undefined
  menuPosition.value = [event.clientX, event.clientY]
  showContextMenu.value = true
}

const isCut = (id: string) =>
  props.clipboard.some((item) => item.action === 'cut' && item.data.id === id)

const { width: containerWidth } = useElementSize(mediaItemContainerRef)
const colsPerRow = computed(() => {
  const itemWidth = (props.itemSize || 140) + 4
  return Math.max(1, Math.floor((containerWidth.value + 4) / itemWidth))
})

const chunkedItems = computed(() => {
  const chunks: UnifiedItem[][] = []
  const size = colsPerRow.value
  for (let i = 0; i < props.items.length; i += size) chunks.push(props.items.slice(i, i + size))
  return chunks
})
</script>

<style scoped>
.media-item-list-container:focus {
  outline: none;
}
.selection-box {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
</style>
