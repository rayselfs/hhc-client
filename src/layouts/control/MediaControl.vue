<template>
  <MediaPresenter v-if="isPresenting" />
  <v-container v-else fluid class="pa-0">
    <v-row no-gutters>
      <v-col cols="12" class="pa-4">
        <div class="py-1 d-flex align-center mb-2">
          <FolderBreadcrumbs :items="breadcrumbItems" @navigate="navigateToFolder" />
          <v-spacer></v-spacer>
          <SortMenu :sort-by="sortBy" :sort-order="sortOrder" @sort="setSort" />
          <ViewModeMenu v-model:view-mode="viewMode" />
        </div>

        <div class="align-star d-block">
          <MediaItemList
            :items="sortedUnifiedItems"
            v-model:selected-items="selectedItems"
            :clipboard="clipboard"
            :sort-by="sortBy"
            :sort-order="sortOrder === 'none' || sortOrder === null ? undefined : sortOrder"
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
          accept="image/*,video/*,.pdf,.mkv,.avi,.mov,.wmv,.flv,.ts,.m2ts"
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
import { ref, computed, onMounted, watch } from 'vue'
import { useMediaFolderStore } from '@/stores/folder'
import { useSnackBar } from '@/composables/useSnackBar'
import { storeToRefs } from 'pinia'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { useProjectionStore } from '@/stores/projection'
import {
  MediaItemList,
  MediaPresenter,
  MediaBackgroundMenu,
  SortMenu,
  ViewModeMenu,
} from '@/components/Media'
import { CreateEditFolderDialog, DeleteConfirmDialog, FolderBreadcrumbs } from '@/components/Shared'
import { useFolderDialogs } from '@/composables/useFolderDialogs'
import { useMediaOperations } from '@/composables/useMediaOperations'
import { useI18n } from 'vue-i18n'
import { useCardLayout } from '@/composables/useLayout'
import { APP_CONFIG } from '@/config/app'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

import { MessageType, ViewType } from '@/types/projection'
import type { FileItem } from '@/types/folder'

import { MediaFolder } from '@/types/enum'

const { t } = useI18n()
const { sendProjectionMessage, setProjectionState } = useProjectionManager()
const { showSnackBar } = useSnackBar()
const mediaStore = useMediaFolderStore()
const mediaProjectionStore = useMediaProjectionStore()
const projectionStore = useProjectionStore()
const { viewMode } = storeToRefs(mediaStore)
const itemSize = computed(() => {
  switch (viewMode.value) {
    case 'large':
      return 230
    case 'medium':
      return 160
    case 'small':
      return 110
    default:
      return 160
  }
})

const { isPresenting } = storeToRefs(mediaProjectionStore)
const { currentFolderPath, clipboard } = storeToRefs(mediaStore)

const breadcrumbItems = computed(() => {
  return currentFolderPath.value.map((id) => ({
    id,
    name: getFolderById(id)?.name || '',
  }))
})

const { navigateToFolder, getFolderById, clearClipboard } = mediaStore

const { mediaSpaceHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
})

const selectedItems = ref<Set<string>>(new Set())

const mediaDialogs = useFolderDialogs<FileItem>()
const operations = useMediaOperations(mediaStore, mediaDialogs, {
  get value() {
    return selectedItems.value
  },
  clear: () => selectedItems.value.clear(),
})

watch(
  () => currentFolderPath.value,
  () => {
    selectedItems.value.clear()
  },
  { deep: true },
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
  const newName = getUniqueName(baseName, 'folder')
  openCreateFolderDialog(newName)
}

const handleDeleteFromList = () => {
  openDeleteSelectionDialog()
}

const {
  // Operations
  isDuplicateName,
  nameErrorMessage,
  handleSave,
  confirmDeleteAction,
  handleCopy,
  handleCut,
  handlePaste,
  handlePasteIntoFolder,
  getUniqueName,

  // Upload
  fileInput,
  folderInput,
  uploadFile,
  uploadFolder,
  handleFileChange,
  handleFolderUpload,

  // Sort
  sortBy,
  sortOrder,
  setSort,
  sortedUnifiedItems,
} = operations

import { KEYBOARD_SHORTCUTS } from '@/config/shortcuts'

onMounted(async () => {
  await mediaStore.loadRootFolder()
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

const { loadChildren } = mediaStore

const handleSortChange = (mode: 'custom') => {
  if (mode === 'custom') {
    sortBy.value = 'custom'
    sortOrder.value = 'none' // 'none' implies Custom
  }
}

const startPresentation = async (startItem?: FileItem, fromBeginning = false) => {
  projectionStore.setCurrentView(ViewType.MEDIA)

  const allFiles = sortedUnifiedItems.value.filter((i) => !('items' in i)) as FileItem[]
  const presentableFiles = allFiles.filter((f) => f.permissions?.canPresent !== false)

  if (presentableFiles.length === 0) {
    showSnackBar(t('fileExplorer.noFiles'), {
      color: 'warning',
    })
    return
  }

  let startIndex = 0
  if (startItem) {
    const idx = presentableFiles.findIndex((f) => f.id === startItem.id)
    startIndex = idx >= 0 ? idx : 0
  } else if (fromBeginning) {
    startIndex = 0
  }

  // Use setProjectionState to handle window creation (with wait), view switching, and content toggle
  await setProjectionState(false, ViewType.MEDIA)

  mediaProjectionStore.setPlaylist(presentableFiles, startIndex)

  sendProjectionMessage(MessageType.MEDIA_UPDATE, {
    playlist: JSON.parse(JSON.stringify(presentableFiles)),
    currentIndex: startIndex,
    action: 'update',
  })
}

const previewFile = (item: FileItem) => {
  selectedItems.value.clear()
  startPresentation(item)
}

// Start presentation from beginning (Shift+F5 or similar)
const handleMediaF5 = (e: KeyboardEvent) => {
  startPresentation(undefined, e.altKey ? false : true)
}

const handleSelectAll = () => {
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
  /* Override: Ensure hover background takes precedence over Vuetify default */
  background-color: rgba(var(--v-theme-primary), 0.3) !important;
}
.user-select-none {
  user-select: none;
}
.ga-2 {
  gap: 8px;
}
</style>
