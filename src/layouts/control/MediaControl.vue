<template>
  <MediaPresenter v-if="isPresenting" />
  <v-container v-else fluid class="pa-0">
    <v-row no-gutters>
      <v-col cols="12" class="pa-4">
        <!-- Top Bar: Breadcrumbs and Actions -->
        <MediaHeader :breadcrumb-items="breadcrumbItems" @navigate="navigateToFolder" />

        <div class="pt-3 d-flex gap-2" style="min-height: 52px">
          <transition name="fade" mode="out-in">
            <!-- Selection Actions Bar -->
            <MediaSelectionBar
              v-if="selectedItems.size > 0"
              key="selection-actions"
              :selected-count="selectedItems.size"
              @clear="clearSelection"
              @edit="handleEditSelected"
              @copy="handleCopy"
              @cut="handleCut"
              @delete="openDeleteSelectionDialog"
            />
            <!-- Filter Actions Btn -->
            <div v-else key="filter-actions" class="d-flex w-100 align-center">
              <div class="d-flex items-center">
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn variant="outlined" class="mr-2 rounded-lg" v-bind="props">
                      {{ $t('common.type') }} <v-icon end icon="mdi-chevron-down"></v-icon>
                    </v-btn>
                  </template>
                  <v-list density="compact" class="rounded-lg">
                    <v-list-item
                      :title="$t('fileExplorer.image')"
                      value="image"
                      prepend-icon="mdi-image"
                    ></v-list-item>
                    <v-list-item
                      :title="$t('fileExplorer.video')"
                      value="video"
                      prepend-icon="mdi-video"
                    ></v-list-item>
                    <v-list-item
                      :title="$t('fileExplorer.pdf')"
                      value="pdf"
                      prepend-icon="mdi-file-pdf-box"
                    ></v-list-item>
                    <v-list-item
                      :title="$t('fileExplorer.youtube')"
                      value="youtube"
                      prepend-icon="mdi-youtube"
                    ></v-list-item>
                    <v-list-item
                      :title="$t('fileExplorer.folder')"
                      value="folder"
                      prepend-icon="mdi-folder"
                    ></v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </div>
          </transition>
        </div>

        <div
          ref="mediaContainer"
          class="pt-6 align-start overflow-y-auto overflow-x-hidden d-block"
          :style="{ height: `${mediaSpaceHeight}px` }"
          @mousedown="onSelectionMouseDown"
          @contextmenu.prevent="openBackgroundContextMenu"
        >
          <!-- Sort -->
          <div class="align-center ml-auto mb-2">
            <div>
              <v-menu>
                <template #activator="{ props }">
                  <v-chip variant="text" link class="mr-2" v-bind="props">
                    {{ sortBy === 'name' ? $t('common.name') : $t('fileExplorer.updatedDate') }}
                    <v-icon
                      v-if="sortBy !== 'custom'"
                      end
                      :icon="sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                    ></v-icon>
                  </v-chip>
                </template>
                <v-list density="compact" class="rounded-lg">
                  <v-list-item
                    :title="$t('common.name')"
                    prepend-icon="mdi-sort-alphabetical-variant"
                    @click="setSort('name')"
                  >
                    <template #append>
                      <v-icon
                        v-if="sortBy === 'name'"
                        :icon="sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                        size="small"
                      ></v-icon>
                    </template>
                  </v-list-item>
                  <v-list-item
                    :title="$t('fileExplorer.updatedDate')"
                    prepend-icon="mdi-calendar-clock"
                    @click="setSort('date')"
                  >
                    <template #append>
                      <v-icon
                        v-if="sortBy === 'date'"
                        :icon="sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                        size="small"
                      ></v-icon>
                    </template>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>

          <!-- Folders Section -->
          <MediaFolderList
            :folders="sortedFolders"
            :selected-items="selectedItems"
            :clipboard="clipboard"
            @drag-start="onDragStart"
            @drop="onDrop"
            @select="handleSelection"
            @open="openFolder"
            @context-menu="openContextMenu"
          />

          <!-- Files Section -->
          <MediaFileList
            :items="sortedItems"
            :selected-items="selectedItems"
            :clipboard="clipboard"
            @drag-start="onDragStart"
            @drag-end="handleDragEnd"
            @drop="onDrop"
            @select="handleSelection"
            @preview="previewFile"
            @context-menu="openContextMenu"
            @edit="openEditDialog"
            @copy="handleCopy"
            @cut="handleCut"
            @delete="openDeleteItemDialog"
          />
        </div>

        <!-- Floating Action Button for New Content -->
        <v-menu location="top start" offset="10">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              position="fixed"
              location="bottom right"
              icon="mdi-plus"
              size="large"
              color="white"
              elevation="4"
              class="mb-6 mr-6"
              style="color: black; z-index: 100"
            ></v-btn>
          </template>
          <v-list class="rounded-lg elevation-4 py-2" width="200">
            <v-list-item
              prepend-icon="mdi-folder-plus-outline"
              :title="$t('fileExplorer.newFolder')"
              @click="createNewFolder"
            ></v-list-item>
            <v-divider class="my-2"></v-divider>
            <v-list-item
              prepend-icon="mdi-file-upload-outline"
              :title="$t('fileExplorer.fileUpload')"
              @click="uploadFile"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-folder-upload-outline"
              :title="$t('fileExplorer.folderUpload')"
              @click="uploadFolder"
            ></v-list-item>
          </v-list>
        </v-menu>

        <!-- Hidden Inputs -->
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/*,video/*,.pdf"
          style="display: none"
          @change="handleFileChange"
        />
        <input
          ref="folderInput"
          type="file"
          webkitdirectory
          directory
          style="display: none"
          @change="handleFolderUpload"
        />

        <!-- Create/Edit Folder Dialog -->
        <CreateEditFolderDialog
          v-model="showFolderDialog"
          :title="
            editingFolderId ? $t('fileExplorer.folderSettings') : $t('fileExplorer.newFolder')
          "
          :folder-name="folderName"
          @update:folder-name="folderName = $event"
          :retention-period="retentionPeriod"
          @update:retention-period="retentionPeriod = $event"
          :retention-options="retentionOptions"
          :error-messages="nameErrorMessage"
          :disable-confirm="!folderName.trim() || isDuplicateName"
          :confirm-text="editingFolderId ? $t('common.confirm') : $t('common.create')"
          show-retention
          @confirm="handleSave"
        />

        <!-- Delete Confirm Dialog -->
        <DeleteConfirmDialog
          v-model="showDeleteConfirmDialog"
          :item-name="folderToDelete?.name || itemToDelete?.name"
          :is-folder="!!folderToDelete"
          :count="selectedItems.size"
          @confirm="confirmDeleteAction"
        />
      </v-col>
    </v-row>

    <!-- Selection Box -->
    <div
      v-if="selectionBox"
      class="selection-box border-primary border"
      :style="{ ...selectionBox, backgroundColor: 'rgba(var(--v-theme-primary), 0.1)' }"
    ></div>

    <!-- Context Menu for Items -->
    <ContextMenu ref="contextMenuRef" :close-on-content-click="true">
      <v-list-item
        v-if="
          contextMenuTarget && (!selectedItems.has(contextMenuTarget.id) || selectedItems.size <= 1)
        "
        prepend-icon="mdi-pencil"
        :title="$t('common.edit')"
        @click="contextMenuTarget && openEditDialog(contextMenuTarget)"
      ></v-list-item>

      <v-list-item
        prepend-icon="mdi-content-copy"
        :title="$t('common.copy')"
        @click="handleCopy"
      ></v-list-item>

      <v-list-item
        prepend-icon="mdi-content-cut"
        :title="$t('common.cut')"
        @click="handleCut"
      ></v-list-item>

      <v-list-item
        prepend-icon="mdi-delete"
        :title="$t('common.delete')"
        color="error"
        @click="
          selectedItems.size > 1
            ? openDeleteSelectionDialog()
            : contextMenuTarget &&
              ('folders' in contextMenuTarget
                ? openDeleteFolderDialog(contextMenuTarget as Folder<FileItem>)
                : openDeleteItemDialog(contextMenuTarget as FileItem))
        "
      ></v-list-item>
    </ContextMenu>

    <!-- Context Menu for Background -->
    <ContextMenu ref="backgroundContextMenuRef" :close-on-content-click="true">
      <v-list-item
        prepend-icon="mdi-folder-plus"
        :title="$t('fileExplorer.newFolder')"
        @click="createNewFolder"
      ></v-list-item>

      <v-list-item
        prepend-icon="mdi-upload"
        :title="$t('fileExplorer.fileUpload')"
        @click="fileInput?.click()"
      ></v-list-item>

      <v-list-item
        prepend-icon="mdi-folder-upload"
        :title="$t('fileExplorer.folderUpload')"
        @click="folderInput?.click()"
      ></v-list-item>

      <v-divider class="my-1"></v-divider>

      <v-list-item
        prepend-icon="mdi-content-paste"
        :title="$t('common.paste')"
        :disabled="clipboard.length === 0"
        @click="handlePaste"
      ></v-list-item>
    </ContextMenu>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMediaStore } from '@/stores/media'
import { useSnackBar } from '@/composables/useSnackBar'
import ContextMenu from '@/components/ContextMenu.vue'
import { storeToRefs } from 'pinia'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import MediaPresenter from '@/components/Media/MediaPresenter.vue'
import MediaFolderList from '@/components/Media/MediaFolderList.vue'
import MediaFileList from '@/components/Media/MediaFileList.vue'
import MediaHeader from '@/components/Media/MediaHeader.vue'
import MediaSelectionBar from '@/components/Media/MediaSelectionBar.vue'

import CreateEditFolderDialog from '@/components/Shared/CreateEditFolderDialog.vue'
import DeleteConfirmDialog from '@/components/Shared/DeleteConfirmDialog.vue'
import { useMediaSort } from '@/composables/useMediaSort'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { useDragSelection } from '@/composables/useDragSelection'
import { useFolderDialogs } from '@/composables/useFolderDialogs'
import { useMediaOperations } from '@/composables/useMediaOperations'
import { MessageType, ViewType } from '@/types/common'

import type { Folder, FileItem } from '@/types/common'
import { useI18n } from 'vue-i18n'
import { useCardLayout } from '@/composables/useLayout'
import { APP_CONFIG } from '@/config/app'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useDragAndDrop } from '@/composables/useDragAndDrop'
import { isValidDragData } from '@/utils/typeGuards'

const { t } = useI18n()
const { ensureProjectionWindow } = useElectron()
const { sendProjectionMessage } = useProjectionMessaging()
const { showSnackBar } = useSnackBar()
const mediaStore = useMediaStore()
const mediaProjectionStore = useMediaProjectionStore()
const { isPresenting } = storeToRefs(mediaProjectionStore)
const {
  currentFolderPath,
  getCurrentFolders: currentFolders,
  getCurrentItems: currentItems,
  clipboard,
} = storeToRefs(mediaStore)

const breadcrumbItems = computed(() => {
  return currentFolderPath.value.map((id) => ({
    id,
    name: getFolderById(id)?.name || '',
  }))
})

// Navigation actions
const { navigateToFolder, getFolderById, clearClipboard } = mediaStore

const {
  fileInput,
  folderInput,
  uploadFile,
  uploadFolder,
  handleFileChange,
  handleFolderUpload,
  getUniqueName,
} = useMediaUpload()

const { mediaSpaceHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
})

// Selection
const selectedItems = ref<Set<string>>(new Set())
const lastSelectedId = ref<string | null>(null)

const clearSelection = () => {
  selectedItems.value.clear()
}

// Dialogs & Operations
const mediaDialogs = useFolderDialogs<FileItem>()
const operations = useMediaOperations(
  mediaStore,
  mediaDialogs,
  {
    get value() {
      return selectedItems.value
    },
    clear: clearSelection,
  },
  showSnackBar,
  getUniqueName,
)

const {
  showFolderDialog,
  folderName,
  retentionPeriod,
  retentionOptions,
  editingFolderId,
  showDeleteConfirmDialog,
  folderToDelete,
  itemToDelete,
  openCreateFolderDialog,
  openEditDialog,
  openDeleteFolderDialog,
  openDeleteItemDialog,
  openDeleteSelectionDialog,
} = mediaDialogs

// Create New Folder with Unique Name
const createNewFolder = () => {
  const baseName = t('fileExplorer.defaultFolderName')
  let newName = baseName
  let counter = 2

  const existingNames = new Set(currentFolders.value.map((f: Folder<FileItem>) => f.name))

  while (existingNames.has(newName)) {
    newName = `${baseName} ${counter}`
    counter++
  }

  openCreateFolderDialog(newName)
}

// Handle edit for single selected item from selection bar
const handleEditSelected = () => {
  if (selectedItems.value.size !== 1) return

  const selectedId = [...selectedItems.value][0]
  const folder = currentFolders.value.find((f) => f.id === selectedId)
  if (folder) {
    openEditDialog(folder)
    return
  }

  const item = currentItems.value.find((i) => i.id === selectedId)
  if (item) {
    openEditDialog(item)
  }
}

const {
  isDuplicateName,
  nameErrorMessage,
  handleSave,
  confirmDeleteAction,
  handleCopy,
  handleCut,
  handlePaste,
} = operations

// Drag Selection
const mediaContainer = ref<HTMLElement | null>(null)
const {
  selectionBox,
  onMouseDown: onSelectionMouseDown,
  isDragging,
} = useDragSelection({
  containerRef: mediaContainer,
  selectedIds: selectedItems,
})

const { sortBy, sortOrder, setSort, sortedFolders, sortedItems } = useMediaSort(
  currentFolders,
  currentItems,
)

onMounted(async () => {
  mediaStore.loadRootFolder()
  // Trigger initial load for root folder
  await loadChildren('media-root')
  document.addEventListener('keydown', handleEsc)
  window.addEventListener('keydown', handleGlobalKeydown)
})

const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const backgroundContextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const contextMenuTarget = ref<Folder<FileItem> | FileItem | null>(null)

const openBackgroundContextMenu = (event: MouseEvent) => {
  if (isDragging.value) return
  contextMenuRef.value?.close()
  backgroundContextMenuRef.value?.open(event)
}

const openContextMenu = async (target: Folder<FileItem> | FileItem, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!selectedItems.value.has(target.id)) {
    handleSelection(target.id, event)
  }

  backgroundContextMenuRef.value?.close()
  contextMenuTarget.value = target
  contextMenuRef.value?.open(event)
}

const openFolder = async (folderId: string) => {
  mediaStore.enterFolder(folderId)
  clearSelection()
  // Lazy load children when entering folder
  await loadChildren(folderId)
}

const handleSelection = (id: string, event?: MouseEvent) => {
  const isMultiSelect = event?.ctrlKey || event?.metaKey
  const isShiftSelect = event?.shiftKey

  if (isShiftSelect && lastSelectedId.value) {
    const allIds = [...sortedFolders.value.map((f) => f.id), ...sortedItems.value.map((i) => i.id)]
    const start = allIds.indexOf(lastSelectedId.value)
    const end = allIds.indexOf(id)

    if (start !== -1 && end !== -1) {
      const [lower, upper] = [Math.min(start, end), Math.max(start, end)]
      const rangeIds = allIds.slice(lower, upper + 1)

      if (!isMultiSelect) {
        selectedItems.value.clear()
      }

      rangeIds.forEach((rid) => selectedItems.value.add(rid))
    }
  } else if (isMultiSelect) {
    if (selectedItems.value.has(id)) {
      selectedItems.value.delete(id)
    } else {
      selectedItems.value.add(id)
      lastSelectedId.value = id
    }
  } else {
    // Single click
    if (selectedItems.value.size === 1 && selectedItems.value.has(id)) {
      return
    }
    selectedItems.value.clear()
    selectedItems.value.add(id)
    lastSelectedId.value = id
  }
}

const handleEsc = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    const isDialogOpen = showFolderDialog.value || showDeleteConfirmDialog.value
    if (!isDialogOpen) {
      if (clipboard.value.some((item) => item.action === 'cut')) {
        clearClipboard()
      }

      // User Request: ESC to cancel selection
      if (selectedItems.value.size > 0) {
        clearSelection()
      }
    }
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEsc)

  // Reset cut state when leaving the page
  if (clipboard.value.some((item) => item.action === 'cut')) {
    clearClipboard()
  }
})

const {
  reorderCurrentItems,
  reorderCurrentFolders,
  moveItem,
  moveFolder,
  currentFolder,
  loadChildren,
} = mediaStore

const { handleDragStart, handleDragEnd } = useDragAndDrop<FileItem>({
  itemSelector: '[data-id]',
})

// Helper to get selected objects
const getAllSelectedItems = () => {
  const selectedIds = selectedItems.value
  const allItems: (FileItem | Folder<FileItem>)[] = []

  selectedIds.forEach((id) => {
    const folder = sortedFolders.value.find((f) => f.id === id)
    if (folder) {
      allItems.push(folder)
    } else {
      const file = sortedItems.value.find((i) => i.id === id)
      if (file) {
        allItems.push(file)
      }
    }
  })
  return allItems
}

const onDragStart = (event: DragEvent, item: FileItem | Folder<FileItem>) => {
  const type = 'items' in item ? 'folder' : 'file'
  handleDragStart(event, type, item, selectedItems.value, getAllSelectedItems)
}

const onDrop = (event: DragEvent, target: FileItem | Folder<FileItem>) => {
  const dataString = event.dataTransfer?.getData('application/json')
  if (!dataString) return

  let draggedType: string
  let draggedItems: (FileItem | Folder<FileItem>)[] = []

  try {
    const parsed = JSON.parse(dataString)
    if (!isValidDragData<FileItem>(parsed)) return

    draggedType = parsed.type
    draggedItems = parsed.items
  } catch {
    return
  }

  const isTargetFolder = 'items' in target
  const targetId = target.id

  // Determine Zone (Move or Reorder)
  // Get element rect
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left
  const width = rect.width

  // Center Zone (middle 50%) for Move-Into logic
  // Only applies if Target is Folder
  const isCenter = x > width * 0.25 && x < width * 0.75
  const isMove = isCenter && isTargetFolder

  if (isMove) {
    const sourceFolderId = currentFolder?.id || APP_CONFIG.FOLDER.ROOT_ID
    let moveCount = 0

    // Filter out items that are the target itself (prevent self-drop)
    const validItems = draggedItems.filter((item) => item.id !== targetId)

    for (const item of validItems) {
      if (draggedType === 'file') {
        const fileItem = currentItems.value.find((i) => i.id === item.id)
        if (fileItem) {
          moveItem(fileItem, targetId, sourceFolderId)
          moveCount++
        }
      } else if (draggedType === 'folder' && isTargetFolder) {
        const folderItem = currentFolders.value.find((f) => f.id === item.id)
        if (folderItem) {
          if (moveFolder(folderItem, targetId, currentFolder?.id)) {
            moveCount++
          }
        }
      }
    }

    if (moveCount > 0) {
      showSnackBar(t('fileExplorer.moveSuccess'), 'success')
      clearSelection()
    }
  } else {
    // Perform Reorder (Only supports single item reorder for now to keep logic simple, or we impl multi-reorder)
    // For now, let's take the first item if multiple
    if (draggedItems.length === 1) {
      const draggedItem = draggedItems[0]
      if (!draggedItem) return

      const draggedId = draggedItem.id
      if (draggedId === targetId) return

      if (draggedType === 'file' && !isTargetFolder) {
        // Reorder Files
        const items = [...sortedItems.value]
        const fromIndex = items.findIndex((i) => i.id === draggedId)
        const toIndex = items.findIndex((i) => i.id === targetId)

        if (fromIndex !== -1 && toIndex !== -1) {
          const deleted = items.splice(fromIndex, 1)
          const movedItem = deleted[0]
          if (movedItem) {
            items.splice(toIndex, 0, movedItem)
            reorderCurrentItems(items)
            sortBy.value = 'custom'
          }
        }
      } else if (draggedType === 'folder' && isTargetFolder) {
        // Reorder Folders
        const folders = [...sortedFolders.value]
        const fromIndex = folders.findIndex((f) => f.id === draggedId)
        const toIndex = folders.findIndex((f) => f.id === targetId)

        if (fromIndex !== -1 && toIndex !== -1) {
          const deleted = folders.splice(fromIndex, 1)
          const movedFolder = deleted[0]
          if (movedFolder) {
            folders.splice(toIndex, 0, movedFolder)
            reorderCurrentFolders(folders)
            sortBy.value = 'custom'
          }
        }
      }
    }
  }
}

const startPresentation = async (startItem?: FileItem, fromBeginning = false) => {
  // Get all file items in current folder
  // User Request: Projection order should follow current sort order
  const files = sortedItems.value.filter((i) => i.type === 'file') as FileItem[]

  if (files.length === 0) {
    showSnackBar(t('fileExplorer.noFiles'), 'warning')
    return
  }

  const startIndex = startItem
    ? files.findIndex((f) => f.id === startItem.id)
    : fromBeginning
      ? 0
      : 0

  const validIndex = startIndex >= 0 ? startIndex : 0

  await ensureProjectionWindow()

  // Initialize store
  mediaProjectionStore.setPlaylist(files, validIndex)

  // Switch projection view
  sendProjectionMessage(MessageType.VIEW_CHANGE, { view: ViewType.MEDIA })

  // Sync first update
  sendProjectionMessage(MessageType.MEDIA_UPDATE, {
    playlist: JSON.parse(JSON.stringify(files)),
    currentIndex: validIndex,
    action: 'update',
  })
}

const previewFile = (item: FileItem) => {
  clearSelection()
  startPresentation(item)
}

// Global Keyboard Shortcuts for Presentation
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'F5') {
    e.preventDefault()
    startPresentation(undefined, e.altKey ? false : true)
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// Keyboard shortcuts
useKeyboardShortcuts({
  onCopy: handleCopy,
  onCut: handleCut,
  onPaste: handlePaste,
  onDelete: openDeleteSelectionDialog,
})
</script>

<style scoped>
.hover-bg-grey-darken-2:hover {
  background-color: rgba(var(--v-theme-primary), 0.3) !important;
}
.user-select-none {
  user-select: none;
}
.selection-box {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
.gap-2 {
  gap: 8px;
}
.drag-over {
  border: 2px solid rgb(var(--v-theme-primary)) !important;
  background-color: rgba(var(--v-theme-primary), 0.1) !important;
  border-radius: 8px;
}
</style>
