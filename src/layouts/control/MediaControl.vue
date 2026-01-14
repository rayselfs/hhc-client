<template>
  <MediaPresenter v-if="isPresenting" />
  <v-container v-else fluid class="pa-0">
    <v-row no-gutters>
      <v-col cols="12" class="py-2 px-4">
        <div class="py-1 d-flex align-center mb-2">
          <FolderBreadcrumbs :items="breadcrumbItems" @navigate="navigateToFolder" />
          <v-spacer></v-spacer>
          <!-- Sort Menu -->
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                variant="text"
                prepend-icon="mdi-sort"
                class="text-none mr-2"
                density="comfortable"
              >
                {{ $t('common.sort') }}
              </v-btn>
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
              <v-list-item
                :title="$t('common.type')"
                prepend-icon="mdi-file-tree"
                @click="setSort('type')"
              >
                <template #append>
                  <v-icon
                    v-if="sortBy === 'type'"
                    :icon="sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'"
                    size="small"
                  ></v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-menu>

          <!-- View Menu -->
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                variant="text"
                prepend-icon="mdi-view-grid-outline"
                class="text-none"
                density="comfortable"
              >
                {{ $t('common.view') }}
              </v-btn>
            </template>
            <v-list density="compact" class="rounded-lg">
              <v-list-item
                :title="$t('media.largeIcons')"
                prepend-icon="mdi-view-grid"
                @click="viewMode = 'large'"
              >
                <template #append>
                  <v-icon v-if="viewMode === 'large'" icon="mdi-check" size="small"></v-icon>
                </template>
              </v-list-item>
              <v-list-item
                :title="$t('media.mediumIcons')"
                prepend-icon="mdi-view-module"
                @click="viewMode = 'medium'"
              >
                <template #append>
                  <v-icon v-if="viewMode === 'medium'" icon="mdi-check" size="small"></v-icon>
                </template>
              </v-list-item>
              <v-list-item
                :title="$t('media.smallIcons')"
                prepend-icon="mdi-view-comfy"
                @click="viewMode = 'small'"
              >
                <template #append>
                  <v-icon v-if="viewMode === 'small'" icon="mdi-check" size="small"></v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>

        <div class="align-star d-block">
          <div class="align-center d-flex" style="min-height: 40px">
            <transition name="fade" mode="out-in">
              <MediaSelectionBar
                v-if="selectedItems.size > 0"
                key="selection-actions"
                :selected-count="selectedItems.size"
                @clear="testClearSelection"
                @edit="handleEditSelected"
                @copy="handleCopy"
                @cut="handleCut"
                @delete="openDeleteSelectionDialog"
              />
            </transition>
          </div>

          <MediaItemList
            :items="sortedUnifiedItems"
            v-model:selected-items="selectedItems"
            :clipboard="clipboard"
            :sort-by="sortBy"
            :sort-order="sortOrder"
            :item-size="itemSize"
            :media-space-height="mediaSpaceHeight"
            @open-presentation="previewFile"
            @sort-change="handleSortChange"
            @edit="openEditDialog"
            @copy="handleCopy"
            @cut="handleCut"
            @delete="handleDeleteFromList"
            @paste="handlePaste"
            @create-folder="createNewFolder"
            @upload-file="uploadFile"
            @upload-folder="uploadFolder"
            @paste-into-folder="handlePasteIntoFolder"
          />
        </div>

        <!-- Floating Action Button for New Content -->
        <v-menu v-model="showFabMenu" location="top start" offset="10">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
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
          <MediaBackgroundMenu
            :model-value="showFabMenu"
            :is-fab="true"
            @create-folder="createNewFolder"
            @upload-file="uploadFile"
            @upload-folder="uploadFolder"
          />
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
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMediaFolderStore } from '@/stores/folder'
import { useSnackBar } from '@/composables/useSnackBar'
import { storeToRefs } from 'pinia'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import {
  MediaItemList,
  MediaPresenter,
  MediaSelectionBar,
  MediaBackgroundMenu,
} from '@/components/Media'
import { CreateEditFolderDialog, DeleteConfirmDialog, FolderBreadcrumbs } from '@/components/Shared'
import { useMediaSort } from '@/composables/useMediaSort'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { useFolderDialogs } from '@/composables/useFolderDialogs'
import { useMediaOperations } from '@/composables/useMediaOperations'
import { useI18n } from 'vue-i18n'
import { useCardLayout } from '@/composables/useLayout'
import { APP_CONFIG } from '@/config/app'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

import { MessageType, ViewType } from '@/types/common'
import type { Folder, FileItem } from '@/types/common'
import { MediaFolder } from '@/types/enum'

const { t } = useI18n()
const { ensureProjectionWindow } = useElectron()
const { sendProjectionMessage } = useProjectionMessaging()
const { showSnackBar } = useSnackBar()
const mediaStore = useMediaFolderStore()
const mediaProjectionStore = useMediaProjectionStore()

// View Mode
const { viewMode } = storeToRefs(mediaStore)
const itemSize = computed(() => {
  switch (viewMode.value) {
    case 'large':
      return 250
    case 'medium':
      return 200
    case 'small':
      return 150
    default:
      return 150
  }
})

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

// Dialogs & Operations
const mediaDialogs = useFolderDialogs<FileItem>()
const operations = useMediaOperations(
  mediaStore,
  mediaDialogs,
  {
    get value() {
      return selectedItems.value
    },
    clear: () => selectedItems.value.clear(),
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

// MediaItemList emits 'delete' which signifies context menu delete
// We should check if it's single or multi select context logic
// But actually MediaItemList handles context menu targeting.
// If it emits 'Delete', it assumes we delete the selection or the target.
// In MediaItemList implementation: `emit('delete')` is called from Context Menu.
// Context Menu logic in MediaItemList should ensure `selectedItems` are correct before emitting?
// Yes, `openContextMenu` calls `handleSelection` if target not in selection.
// So `selectedItems` should be valid for the deletion.
const handleDeleteFromList = () => {
  openDeleteSelectionDialog()
}

const {
  isDuplicateName,
  nameErrorMessage,
  handleSave,
  confirmDeleteAction,
  handleCopy,
  handleCut,
  handlePaste,
  handlePasteIntoFolder,
} = operations

const { sortBy, sortOrder, setSort, sortedUnifiedItems, sortedItems } = useMediaSort(
  currentFolders,
  currentItems,
)

import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

onMounted(async () => {
  mediaStore.loadRootFolder()
  await loadChildren(MediaFolder.ROOT_ID)
})

const showFabMenu = ref(false)

const handleEsc = () => {
  const isDialogOpen = showFolderDialog.value || showDeleteConfirmDialog.value
  if (!isDialogOpen) {
    if (clipboard.value.some((item) => item.action === 'cut')) {
      clearClipboard()
    }

    // User Request: ESC to cancel selection
    if (selectedItems.value.size > 0) {
      selectedItems.value.clear()
    }
  }
}

// Explicit clear for template binding
const testClearSelection = () => selectedItems.value.clear()

const { loadChildren } = mediaStore

const handleSortChange = (mode: 'custom') => {
  sortBy.value = mode
}

const startPresentation = async (startItem?: FileItem, fromBeginning = false) => {
  // Get all file items in current folder
  // User Request: Projection order should follow current sort order
  // Note: sortedItems only contains FILES if we use the original `useMediaSort` properly.
  // My updated `useMediaSort` still exports `sortedItems` (files only).
  // So using `sortedItems` here is correct for Playlist generation (files only).
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
  selectedItems.value.clear()
  startPresentation(item)
}

// Start presentation from beginning (Shift+F5 or similar)
// But we just use F5 for generic start if no item selected?
// Or we check event modifier in the handler.
const handleMediaF5 = (e: KeyboardEvent) => {
  startPresentation(undefined, e.altKey ? false : true)
}

// Select All
const handleSelectAll = () => {
  // Capture Phase helps us avoid inputs, but we double check just in case logic changes
  // Actually, useKeyboardShortcuts already guards inputs.

  // Select all folders and files visible
  const allIds = sortedUnifiedItems.value.map((item) => item.id)
  allIds.forEach((id) => selectedItems.value.add(id))
}

// Keyboard shortcuts
useKeyboardShortcuts([
  { config: KEYBOARD_SHORTCUTS.EDIT.COPY, handler: handleCopy },
  { config: KEYBOARD_SHORTCUTS.EDIT.CUT, handler: handleCut },
  { config: KEYBOARD_SHORTCUTS.EDIT.PASTE, handler: handlePaste },
  { config: KEYBOARD_SHORTCUTS.EDIT.DELETE, handler: openDeleteSelectionDialog },
  { config: KEYBOARD_SHORTCUTS.EDIT.SELECT_ALL, handler: handleSelectAll },
  { config: KEYBOARD_SHORTCUTS.MEDIA.ESCAPE, handler: handleEsc },
  { config: KEYBOARD_SHORTCUTS.MEDIA.START_PRESENTATION, handler: handleMediaF5 },
])
</script>

<style scoped>
.hover-bg-grey-darken-2:hover {
  background-color: rgba(var(--v-theme-primary), 0.3) !important;
}
.user-select-none {
  user-select: none;
}
.gap-2 {
  gap: 8px;
}
</style>
