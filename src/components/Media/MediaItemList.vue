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
    <div v-if="items.length > 0" style="height: 100%">
      <!-- Virtual Scroll for large lists (No animation, just performance) -->
      <v-virtual-scroll
        v-if="useVirtualScroll"
        :items="chunkedItems"
        style="height: 100%"
        class="overflow-y-auto overflow-x-hidden"
      >
        <template #default="{ item: rowItems }">
          <div class="d-flex flex-wrap">
            <div
              v-for="item in rowItems"
              :key="item.id"
              class="pa-2"
              :style="{ width: `${props.itemSize}px` }"
            >
              <MediaItem
                :item="item"
                :is-selected="selectedItems.has(item.id)"
                :is-focused="focusedId === item.id"
                :is-cut="isCut(item.id)"
                :is-dragging="draggedItems.has(item.id)"
                :draggable="canDrag(item)"
                :size="props.itemSize"
                @dragstart="onDragStart($event, item)"
                @dragend="onDragEnd"
                @drop="onDrop($event, item)"
                @dragover="onDragOver($event, item)"
                @dragenter="onDragEnter($event)"
                @dragleave="onDragLeave($event)"
                @click.stop="handleItemClick(item.id, $event)"
                @dblclick="handleDoubleClick(item)"
                @contextmenu.stop.prevent="openContextMenu(item, $event)"
              />
            </div>
          </div>
        </template>
      </v-virtual-scroll>

      <!-- Standard Flex Layout for manual sort and visual feedback -->
      <div v-else class="overflow-y-auto overflow-x-hidden" style="height: 100%">
        <transition-group name="media-list" tag="div" class="d-flex flex-wrap ga-1">
          <div
            v-for="item in localItems"
            :key="item.id"
            class="media-item-wrapper"
            :style="{ width: `${props.itemSize}px` }"
            :data-id="item.id"
          >
            <MediaItem
              :item="item"
              :is-selected="selectedItems.has(item.id)"
              :is-focused="focusedId === item.id"
              :is-cut="isCut(item.id)"
              :is-dragging="draggedItems.has(item.id)"
              :draggable="canDrag(item)"
              :size="props.itemSize"
              @dragstart="onDragStart($event, item)"
              @dragend="onDragEnd"
              @drop="onDrop($event, item)"
              @dragover="onDragOver($event, item)"
              @dragenter="onDragEnter($event)"
              @dragleave="onDragLeave($event)"
              @click.stop="handleItemClick(item.id, $event)"
              @dblclick="handleDoubleClick(item)"
              @contextmenu.stop.prevent="openContextMenu(item, $event)"
            />
          </div>
        </transition-group>
      </div>
    </div>

    <!-- Selection Box -->
    <div
      v-if="selectionBox"
      class="selection-box border-primary border"
      :style="{ ...selectionBox, backgroundColor: 'rgba(var(--v-theme-primary), 0.1)' }"
    ></div>

    <!-- Unified Context Menu -->
    <ContextMenu
      v-model="showContextMenu"
      :activator="menuActivator"
      :position="menuPosition"
      close-on-content-click
      raw
    >
      <!-- Item Context Menu Content -->
      <MediaItemContextMenu
        v-if="contextMenuTarget"
        :target="contextMenuTarget"
        :is-folder="isFolder(contextMenuTarget)"
        :clipboard="clipboard"
        :selected-items="selectedItems"
        @edit="(target) => emit('edit', target)"
        @copy="emit('copy')"
        @cut="emit('cut')"
        @delete="emit('delete')"
        @paste-into-folder="handlePasteIntoFolderFromContextMenu"
      />
      <!-- Background Context Menu Content -->
      <MediaBackgroundMenu
        v-else
        :clipboard="clipboard"
        @create-folder="emit('create-folder')"
        @upload-file="emit('upload-file')"
        @upload-folder="emit('upload-folder')"
        @paste="emit('paste')"
      />
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import type { FileItem, Folder, ClipboardItem } from '@/types/common'
import { MediaFolder } from '@/types/enum'
import { DEFAULT_LOCAL_PERMISSIONS } from '@/services/filesystem'
import MediaItem from './MediaItem.vue'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { useMediaFolderStore } from '@/stores/folder'
import { isValidDragData } from '@/utils/typeGuards'
import { useSnackBar } from '@/composables/useSnackBar'
import { useDragSelection } from '@/composables/useDragSelection'
import MediaItemContextMenu from './MediaItemContextMenu.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import MediaBackgroundMenu from './MediaBackgroundMenu.vue'
import { useSelectionManager } from '@/composables/useSelectionManager'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useElementSize } from '@vueuse/core'

const { getSelectionMode, handleKeyNavigation, focusedId, scrollIntoView } = useSelectionManager()

// Keyboard Shortcuts for Selection/Navigation
useKeyboardShortcuts([]) // Initialize global, but we use local listener for navigation

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
  {
    itemSize: 140,
  },
)

const emit = defineEmits<{
  (e: 'update:selected-items', selected: Set<string>): void
  (e: 'drag-start', event: DragEvent, item: UnifiedItem): void
  (e: 'drag-end', event: DragEvent): void
  (e: 'sort-change', mode: 'custom'): void
  // Actions that need parent coordination (Dialogs)
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

const { name: breakpointName } = useDisplay()
const { t } = useI18n()
const { showSnackBar } = useSnackBar()
const mediaStore = useMediaFolderStore()

const VIRTUAL_SCROLL_THRESHOLD = 50

// Helper to check type
const isFolder = (item: UnifiedItem): item is Folder<FileItem> => {
  return 'items' in item
}

// Local items for manual swap
const localItems = ref<UnifiedItem[]>([])
// Flag to track if a successful drop occurred (to prevent resetting localItems)
const dropSucceeded = ref(false)

const {
  handleDragStart,
  handleDragEnd,
  handleDrop,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  draggedItems,
} = useDragAndDrop<FileItem>({
  itemSelector: '.media-item',
})

watch(
  () => props.items,
  (newVal) => {
    // Only update local items if not currently dragging
    // Otherwise we interrupt the drag
    if (draggedItems.value.size === 0) {
      localItems.value = [...newVal]
    }
  },
  { immediate: true },
)

const mediaSpaceHeight = computed(() => {
  return props.mediaSpaceHeight - 50
})

const useVirtualScroll = computed(() => {
  return props.items.length > VIRTUAL_SCROLL_THRESHOLD
})

// --- Selection Logic ---
const lastSelectedId = ref<string | null>(null)

/**
 * Handle Item Click (Mouse Selection)
 * Delegated to handleSelection Logic
 */
const handleItemClick = (id: string, event: MouseEvent) => {
  // Update focus on click
  focusedId.value = id

  const mode = getSelectionMode(event)
  updateSelection(id, mode)
}

/**
 * Handle Keyboard Navigation
 */
const onKeyDown = (event: KeyboardEvent) => {
  // Navigation (Arrow Keys, Home, End)
  // Use localItems to ensure navigation matches visual order
  const currentItems = localItems.value.length > 0 ? localItems.value : props.items
  const newFocusedId = handleKeyNavigation(
    event,
    currentItems as { id: string }[],
    colsPerRow.value,
  )

  if (newFocusedId) {
    scrollIntoView(mediaItemContainerRef.value as HTMLElement)

    // Standard Behavior: Arrow keys select the item unless modifiers are held
    // If Shift/Ctrl is held, we only move focus (user can press Space to select/toggle)
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
      updateSelection(newFocusedId, 'single')
    } else if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
      // Shift + Arrow: Range Selection (matches SELECT_UP, SELECT_DOWN, etc.)
      updateSelection(newFocusedId, 'range')
    }
  }

  // Selection (Space)
  if (event.code === 'Space') {
    event.preventDefault()
    if (focusedId.value) {
      const mode = getSelectionMode(event)
      // Space usually toggles or selects single if simple Space
      updateSelection(
        focusedId.value,
        mode === 'range-add' ? 'range-add' : event.ctrlKey || event.metaKey ? 'multi' : 'single',
      )
    }
  }

  // Open (Enter)
  if (event.code === 'Enter') {
    if (focusedId.value) {
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
            return
          }
          emit('open-presentation', fileItem)
        }
      }
    }
  }
}

/**
 * Core Selection Update Logic
 */
const updateSelection = (targetId: string, mode: 'single' | 'multi' | 'range' | 'range-add') => {
  const newSelection = new Set(props.selectedItems)

  switch (mode) {
    case 'range':
    case 'range-add':
      if (lastSelectedId.value) {
        const allIds = props.items.map((i) => i.id)
        const start = allIds.indexOf(lastSelectedId.value)
        const end = allIds.indexOf(targetId)

        if (start !== -1 && end !== -1) {
          const [lower, upper] = [Math.min(start, end), Math.max(start, end)]
          const rangeIds = allIds.slice(lower, upper + 1)

          if (mode === 'range') {
            newSelection.clear()
          }
          rangeIds.forEach((rid) => newSelection.add(rid))
        }
      }
      break

    case 'multi':
      if (newSelection.has(targetId)) {
        newSelection.delete(targetId)
      } else {
        newSelection.add(targetId)
        lastSelectedId.value = targetId
      }
      break

    case 'single':
    default:
      if (newSelection.size === 1 && newSelection.has(targetId)) {
        return // Already selected singly
      }
      newSelection.clear()
      newSelection.add(targetId)
      lastSelectedId.value = targetId
      break
  }

  emit('update:selected-items', newSelection)
}

// Drag Selection
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
// Wait, `MediaItem` root element is the target.
// I should use template ref for container.

// --- Drag and Drop Logic ---

const onDragEnter = (event: DragEvent) => {
  handleDragEnter(event)
}

const onDragLeave = (event: DragEvent) => {
  handleDragLeave(event)
}

const canDrag = (item: UnifiedItem) => {
  const permissions = item.permissions || DEFAULT_LOCAL_PERMISSIONS
  return permissions.canMove
}

const onDragStart = (event: DragEvent, item: UnifiedItem) => {
  if (!canDrag(item)) return
  handleDragStart(
    event,
    isFolder(item) ? 'folder' : 'file',
    item,
    props.selectedItems,
    () => props.items.filter((i) => props.selectedItems.has(i.id)), // Use props.items
  )
  emit('drag-start', event, item)
}

const onDragOver = (event: DragEvent, targetItem: UnifiedItem) => {
  handleDragOver(event)

  if (useVirtualScroll.value) return
  if (props.sortBy !== 'custom') return

  if (isFolder(targetItem)) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const x = event.clientX - rect.left
    const width = rect.width
    const percent = x / width
    if (percent > 0.2 && percent < 0.8) {
      // In Nesting Zone -> Do not swap
      return
    }
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

  // Only reset localItems if drop didn't succeed (e.g., drag cancelled)
  // If drop succeeded, localItems is already correct and store is updated
  if (!dropSucceeded.value) {
    localItems.value = [...props.items]
  }
  dropSucceeded.value = false
}

const handleMove = async (event: DragEvent, target: Folder<FileItem>) => {
  const dataString = event.dataTransfer?.getData('application/json')
  if (!dataString) return

  let draggedType: string
  let draggedItemsData: (FileItem | Folder<FileItem>)[] = []

  try {
    const parsed = JSON.parse(dataString)
    if (!isValidDragData<FileItem>(parsed)) return

    draggedType = parsed.type
    draggedItemsData = parsed.items
  } catch {
    return
  }

  const targetId = target.id
  const sourceFolderId = mediaStore.currentFolder?.id || MediaFolder.ROOT_ID
  let moveCount = 0

  const validItems = draggedItemsData.filter((item) => item.id !== targetId)

  // We need to differentiate File vs Folder from the dragged data
  // But `moveItem`/`moveFolder` needs the ACTUAL object from current state usually?
  // Or just ID? Store actions take Objects usually to update state correctly.

  for (const item of validItems) {
    if (draggedType === 'file') {
      // Find in Unified List
      const fileItem = props.items.find((i) => i.id === item.id) as FileItem | undefined
      if (fileItem && !isFolder(fileItem)) {
        mediaStore.moveItem(fileItem, targetId, sourceFolderId)
        moveCount++
      }
    } else if (draggedType === 'folder') {
      const folderItem = props.items.find((f) => f.id === item.id) as Folder<FileItem> | undefined
      if (folderItem && isFolder(folderItem)) {
        const isLastItem = validItems.indexOf(item) === validItems.length - 1
        const moved = await mediaStore.moveFolder(
          folderItem,
          targetId,
          mediaStore.currentFolder?.id,
          !isLastItem,
        )
        if (moved) {
          moveCount++
        }
      }
    }
  }

  if (moveCount > 0) {
    showSnackBar(t('fileExplorer.moveSuccess'), {
      color: 'success',
    })
  }
}

const onDrop = async (event: DragEvent, item: UnifiedItem) => {
  let isNesting = false
  if (isFolder(item)) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const x = event.clientX - rect.left
    const width = rect.width
    const percent = x / width
    if (percent > 0.2 && percent < 0.8) {
      isNesting = true
    }
  }

  if (isNesting && isFolder(item)) {
    handleMove(event, item)
    handleDrop(event, () => {})
  } else {
    // Reorder based on localItems logic
    // NOTE: localItems reflects the order AFTER drag-and-drop simulation in the UI
    const newFolders: Folder<FileItem>[] = []
    const newFiles: FileItem[] = []

    localItems.value.forEach((itm) => {
      if (isFolder(itm)) {
        newFolders.push(itm as Folder<FileItem>)
      } else {
        newFiles.push(itm as FileItem)
      }
    })

    // This updates the store with the NEW physical order derived from localItems
    // If we were in 'Date' mode, localItems is the DATE-sorted list + the drag change.
    // Saving this freezes the sort into Custom (physical) order.
    await mediaStore.reorderCurrentFolders(newFolders)
    await mediaStore.reorderCurrentItems(newFiles)
    emit('sort-change', 'custom')

    // Mark drop as successful to prevent onDragEnd from resetting localItems
    dropSucceeded.value = true
    handleDrop(event, () => {})
  }
}

// --- Navigation ---
const handleDoubleClick = (item: UnifiedItem) => {
  if (isFolder(item)) {
    mediaStore.enterFolder(item.id)
    emit('update:selected-items', new Set())
    mediaStore.loadChildren(item.id)
  } else {
    const fileItem = item as FileItem
    if (fileItem.permissions?.canPresent === false) {
      showSnackBar(t('fileExplorer.ffmpegRequired'), { color: 'warning' })
      return
    }
    emit('open-presentation', fileItem)
  }
}

// --- Context Menu ---
const contextMenuTarget = ref<UnifiedItem | null>(null)
const showContextMenu = ref(false)
const menuActivator = ref<HTMLElement | undefined>(undefined)
const menuPosition = ref<[number, number] | undefined>(undefined)

const openBackgroundContextMenu = (event: MouseEvent) => {
  if (isSelectionDragging.value) return
  event.preventDefault()

  // User Request: Clear selection when clicking on background
  emit('update:selected-items', new Set())

  // Update position for background context menu
  menuPosition.value = [event.clientX, event.clientY]
  menuActivator.value = undefined
  contextMenuTarget.value = null
  showContextMenu.value = true
}

const openContextMenu = (item: UnifiedItem, event: MouseEvent) => {
  event.preventDefault()

  if (!props.selectedItems.has(item.id)) {
    handleItemClick(item.id, event)
  }

  contextMenuTarget.value = item

  // Right click show at mouse
  menuActivator.value = undefined
  menuPosition.value = [event.clientX, event.clientY]
  showContextMenu.value = true
}

const handlePasteIntoFolderFromContextMenu = (folderId: string) => {
  emit('paste-into-folder', folderId)
}

const isCut = (id: string) => {
  return props.clipboard.some((item) => item.action === 'cut' && item.data.id === id)
}

// Calculate columns for Virtual Scroll chunking & Keyboard Navigation
const { width: containerWidth } = useElementSize(mediaItemContainerRef)

const colsPerRow = computed(() => {
  if (containerWidth.value <= 0) {
    // Fallback to breakpoint if width unavailable (e.g. init)
    switch (breakpointName.value) {
      case 'xs':
        return 2
      case 'sm':
        return 3
      case 'md':
        return 4
      case 'lg':
        return 6
      case 'xl':
        return 8
      case 'xxl':
        return 10
      default:
        return 6
    }
  }
  // Layout is flex float: itemSize + gap
  const gap = 4 // ga-1 = 4px
  const itemWidth = (props.itemSize || 140) + gap
  // Floor to get number of items that fit per row
  const cols = Math.floor((containerWidth.value + gap) / itemWidth) // Account for last gap
  return Math.max(1, cols)
})

const chunkedItems = computed(() => {
  const chunks: UnifiedItem[][] = []
  const size = colsPerRow.value
  const items = props.items
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
})
</script>

<style scoped>
/* Ensure virtual scroll takes full height */
:deep(.v-virtual-scroll__container) {
  display: block !important;
}

.media-item-list-container:focus {
  outline: none;
}

/* Transition Group Styles */
.media-list-move, /* apply transition to moving elements */
.media-list-enter-active,
.media-list-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.media-list-enter-from,
.media-list-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

/* ensure leaving items are taken out of layout flow so that moving
   items can be calculated correctly. */
.media-list-leave-active {
  position: absolute;
}

.selection-box {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
</style>
