<template>
  <MediaPresenter v-if="isPresenting" />
  <v-container v-else fluid class="pa-0">
    <v-row no-gutters>
      <v-col cols="12" class="pa-4">
        <!-- Top Bar: Breadcrumbs and Actions -->
        <div class="py-2 d-flex align-center">
          <v-btn
            size="small"
            class="pa-0 text-subtitle-1"
            variant="text"
            :disabled="currentFolderPath.length === 1"
            @click="navigateToRoot()"
          >
            <v-icon class="mr-1">mdi-home</v-icon>
            {{ $t('common.homepage') }}
          </v-btn>
          <span v-for="(folderId, index) in currentFolderPath.slice(1)" :key="folderId">
            <v-icon size="x-small" class="ml-1 mr-1">mdi-chevron-right</v-icon>
            <v-btn
              size="small"
              class="pa-0 text-subtitle-1"
              variant="text"
              :disabled="index === currentFolderPath.length - 2"
              @click="navigateToFolder(folderId)"
            >
              <v-icon class="mr-1">mdi-folder</v-icon>
              {{ getFolderById(folderId)?.name }}
            </v-btn>
          </span>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-view-grid-outline" variant="text" density="comfortable"></v-btn>
        </div>

        <div class="pt-3 d-flex gap-2" style="min-height: 52px">
          <transition name="fade" mode="out-in">
            <!-- Selection Actions Bar -->
            <div
              v-if="selectedItems.size > 0"
              key="selection-actions"
              class="d-flex align-center bg-grey-darken-4 rounded-lg w-100"
            >
              <v-btn
                icon="mdi-close"
                variant="text"
                density="comfortable"
                class="mr-3"
                @click="clearSelection"
              ></v-btn>
              <span class="text-subtitle-1 font-weight-medium mr-4"
                >{{ selectedItems.size }} selected</span
              >
              <v-btn
                icon="mdi-folder-move-outline"
                size="small"
                variant="text"
                density="comfortable"
                class="mr-2"
                :title="$t('common.move')"
                @click="openMoveSelectedDialog"
              ></v-btn>
              <v-btn
                icon="mdi-trash-can-outline"
                size="small"
                variant="text"
                density="comfortable"
                class="mr-2"
                :title="$t('common.delete')"
                @click="confirmDeleteSelected"
              ></v-btn>
            </div>
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
          class="pt-6 align-start overflow-y-auto overflow-x-hidden d-block"
          :style="{ height: `${mediaSpaceHeight}px` }"
          @mousedown="onMouseDown"
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
          <!-- Files Section -->
          <MediaFileList
            :items="sortedItems"
            :selected-items="selectedItems"
            :clipboard="clipboard"
            @drag-start="onDragStart"
            @drop="onDrop"
            @select="handleSelection"
            @preview="previewFile"
            @context-menu="openContextMenu"
            @edit="editItem"
            @move="openMoveDialog"
            @copy="handleCopy"
            @cut="handleCut"
            @delete="confirmDeleteItem"
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
              @click="openCreateFolderDialog"
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

        <!-- Background Context Menu -->
        <div
          v-if="backgroundContextMenu.show.value"
          :style="{
            position: 'fixed',
            left: `${backgroundContextMenu.x.value}px`,
            top: `${backgroundContextMenu.y.value}px`,
          }"
        >
          <v-menu v-model="backgroundContextMenu.show.value" activator="parent">
            <v-list class="rounded-lg elevation-4 py-2" width="200">
              <v-list-item
                prepend-icon="mdi-folder-plus-outline"
                :title="$t('fileExplorer.newFolder')"
                @click="openCreateFolderDialog"
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
              <v-divider class="my-2"></v-divider>
              <v-list-item
                prepend-icon="mdi-content-paste"
                :title="$t('common.paste')"
                :disabled="clipboard.length === 0"
                @click="handlePaste"
              ></v-list-item>
            </v-list>
          </v-menu>
        </div>

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

        <!-- Create Folder Dialog -->
        <v-dialog v-model="showFolderDialog" max-width="400">
          <v-card>
            <v-card-title>{{
              editingFolderId ? $t('fileExplorer.folderSettings') : $t('fileExplorer.newFolder')
            }}</v-card-title>
            <v-card-text>
              <v-text-field
                v-model="folderName"
                :label="$t('fileExplorer.folderName')"
                :error-messages="nameErrorMessage"
                variant="outlined"
                density="compact"
                autofocus
                @keyup.enter="createFolder"
              />

              <v-select
                v-model="retentionPeriod"
                :items="retentionOptions"
                :label="$t('fileExplorer.retentionPeriod')"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="compact"
                class="mt-2"
              />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn @click="showFolderDialog = false">{{ $t('common.cancel') }}</v-btn>
              <v-btn
                color="primary"
                @click="createFolder"
                :disabled="!folderName.trim() || isDuplicateName"
                >{{ editingFolderId ? $t('common.confirm') : $t('common.create') }}</v-btn
              >
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Move Dialog -->
        <v-dialog v-model="showMoveDialog" max-width="500">
          <v-card>
            <v-card-title class="d-flex align-center">
              <span class="mr-3">{{ $t('common.moveTo') }}</span>
              <!-- Breadcrumbs -->
              <div class="d-flex align-center flex-wrap">
                <v-btn
                  size="small"
                  class="pa-0"
                  variant="text"
                  :disabled="moveBreadcrumb.length === 0 && !selectedMoveFolder"
                  @click="navigateMoveToRoot"
                >
                  <v-icon class="mr-1">mdi-home</v-icon>
                  {{ $t('common.homepage') }}
                </v-btn>
                <v-icon
                  v-if="moveBreadcrumb.length > 0 || selectedMoveFolder"
                  size="x-small"
                  class="ml-1 mr-1"
                  >mdi-chevron-right</v-icon
                >
                <span v-for="(folderId, index) in moveBreadcrumb" :key="folderId">
                  <v-btn
                    size="small"
                    class="pa-0"
                    variant="text"
                    :disabled="index === moveBreadcrumb.length - 1"
                    @click="navigateMoveToFolder(folderId)"
                  >
                    <v-icon class="mr-1">mdi-folder</v-icon>
                    {{ getFolderById(folderId)?.name }}
                  </v-btn>
                  <v-icon v-if="index < moveBreadcrumb.length - 1" size="x-small" class="ml-1 mr-1"
                    >mdi-chevron-right</v-icon
                  >
                </span>
              </div>
            </v-card-title>

            <v-card-text>
              <!-- Target List -->
              <div>
                <div v-if="getMoveFolderTargets().length === 0" class="text-center pa-4 text-grey">
                  {{ $t('fileExplorer.noFolder') }}
                </div>
                <div v-else>
                  <div
                    v-for="target in getMoveFolderTargets()"
                    :key="target.id"
                    class="pa-3 mb-2 d-flex align-center justify-space-between rounded cursor-pointer"
                    :class="
                      selectedMoveFolder?.id === target.id
                        ? 'bg-primary'
                        : 'bg-grey-darken-4 hover-bg-grey-darken-2'
                    "
                    @click="selectMoveTarget(target)"
                  >
                    <div class="d-flex align-center">
                      <v-icon class="mr-2">mdi-folder</v-icon>
                      <span>{{ target.name }}</span>
                    </div>
                    <v-icon>mdi-chevron-right</v-icon>
                  </div>
                </div>
              </div>
            </v-card-text>

            <v-card-actions>
              <v-spacer />
              <v-btn @click="showMoveDialog = false">{{ $t('common.cancel') }}</v-btn>
              <v-btn color="primary" @click="confirmMove" :disabled="!canMoveToRoot">
                {{ $t('common.move') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Delete Confirm Dialog -->
        <v-dialog v-model="showDeleteConfirmDialog" max-width="400">
          <v-card>
            <v-card-title>{{ $t('common.confirmDeleteItem') }}</v-card-title>
            <v-card-text>
              <div v-if="folderToDelete" class="mt-2 text-subtitle-1">
                <v-icon class="mr-2">mdi-folder</v-icon>
                <span>{{ folderToDelete.name }}</span>
              </div>
              <div v-else-if="selectedItems.size > 0" class="mt-2 text-subtitle-1">
                {{ selectedItems.size }} items selected
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn @click="showDeleteConfirmDialog = false">{{ $t('common.cancel') }}</v-btn>
              <v-btn color="error" @click="confirmDeleteAction">{{ $t('common.delete') }}</v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-col>
    </v-row>

    <!-- Selection Box -->
    <div
      v-if="selectionBox.isSelecting"
      class="selection-box"
      :style="{
        left: `${selectionBox.x}px`,
        top: `${selectionBox.y}px`,
        width: `${selectionBox.width}px`,
        height: `${selectionBox.height}px`,
      }"
    ></div>

    <!-- Unified Context Menu -->
    <div
      v-if="contextMenu.show.value"
      :style="{
        position: 'fixed',
        left: `${contextMenu.x.value}px`,
        top: `${contextMenu.y.value}px`,
      }"
    >
      <v-menu v-model="contextMenu.show.value" activator="parent">
        <v-list density="compact" class="rounded-lg elevation-2" width="150">
          <v-list-item
            prepend-icon="mdi-pencil"
            :title="$t('common.edit')"
            :disabled="selectedItems.size > 1"
            @click="contextMenuTarget && editItem(contextMenuTarget)"
          ></v-list-item>
          <v-list-item
            prepend-icon="mdi-folder-move-outline"
            :title="$t('common.move')"
            @click="
              selectedItems.size > 1
                ? openMoveSelectedDialog()
                : contextMenuTarget && openMoveDialog(contextMenuTarget)
            "
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
            @click="
              selectedItems.size > 1
                ? confirmDeleteSelected()
                : contextMenuTarget &&
                  ('folders' in contextMenuTarget
                    ? confirmDeleteFolder(contextMenuTarget as Folder<FileItem>)
                    : confirmDeleteItem(contextMenuTarget as FileItem))
            "
          ></v-list-item>
        </v-list>
      </v-menu>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useMediaStore } from '@/stores/media'
import { useSnackBar } from '@/composables/useSnackBar'
import { useContextMenu } from '@/composables/useContextMenu'
import { storeToRefs } from 'pinia'
import { useElectron } from '@/composables/useElectron'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import MediaPresenter from '@/components/Media/MediaPresenter.vue'
import MediaFolderList from '@/components/Media/MediaFolderList.vue'
import MediaFileList from '@/components/Media/MediaFileList.vue'
import { useMediaSort } from '@/composables/useMediaSort'
import { MessageType, ViewType } from '@/types/common'

import type { Folder, FileItem } from '@/types/common'
import { type ClipboardItem } from '@/stores/folder'
import { useI18n } from 'vue-i18n'
import { useCardLayout } from '@/composables/useLayout'
import { APP_CONFIG } from '@/config/app'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'

const { t } = useI18n()
const { isElectron, ensureProjectionWindow, getFilePath, saveFile } = useElectron()
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

// Navigation actions
const {
  navigateToRoot,
  navigateToFolder,
  getFolderById,
  moveItem: moveItemAction,
  moveFolder: moveFolderAction,
  getMoveTargets,
  isFolderInside,
  pasteItem,
  copyToClipboard,
  cutToClipboard,
  clearClipboard,
} = mediaStore

const isNameExists = (name: string, type: 'folder' | 'file') => {
  if (type === 'folder') return currentFolders.value.some((f) => f.name === name)
  return currentItems.value.some((i) => i.name === name)
}

const getUniqueName = (originalName: string, type: 'folder' | 'file') => {
  let name = originalName
  let ext = ''

  if (type === 'file') {
    const lastDotIndex = name.lastIndexOf('.')
    if (lastDotIndex !== -1) {
      ext = name.substring(lastDotIndex)
      name = name.substring(0, lastDotIndex)
    }
  }

  let finalName = originalName
  let counter = 2

  while (isNameExists(finalName, type)) {
    finalName = `${name} ${counter}${ext}`
    counter++
  }

  return finalName
}

const { mediaSpaceHeight } = useCardLayout({
  minHeight: APP_CONFIG.UI.MIN_CARD_HEIGHT,
})

// Dialog & Selection State
const showFolderDialog = ref(false)
const folderName = ref('')
const retentionPeriod = ref('1day')
const editingFolderId = ref<string | null>(null)
const selectedItems = ref<Set<string>>(new Set())
const showDeleteConfirmDialog = ref(false)
const folderToDelete = ref<Folder<FileItem> | null>(null)
const itemToDelete = ref<FileItem | null>(null)

// Move Dialog State
const showMoveDialog = ref(false)
const moveBreadcrumb = ref<string[]>([])
const selectedMoveFolder = ref<Folder<FileItem> | null>(null)
const itemToMove = ref<FileItem | null>(null)
const folderToMove = ref<Folder<FileItem> | null>(null)
const moveType = ref<'file' | 'folder'>('file')

// File Upload
const fileInput = ref<HTMLInputElement | null>(null)

const retentionOptions = computed(() => [
  { title: t('fileExplorer.retention.1day'), value: '1day' },
  { title: t('fileExplorer.retention.1week'), value: '1week' },
  { title: t('fileExplorer.retention.1month'), value: '1month' },
  { title: t('fileExplorer.retention.permanent'), value: 'permanent' },
])

const canMoveToRoot = computed(() => {
  if (moveType.value === 'file') {
    if (!itemToMove.value && selectedItems.value.size === 0) return false
    const isInRoot = currentFolderPath.value.length === 1 // Root has 1 item
    if (isInRoot) {
      return selectedMoveFolder.value !== null
    }
    return true
  } else {
    // Moving folder
    if (!folderToMove.value && selectedItems.value.size === 0) return false

    if (selectedMoveFolder.value && folderToMove.value) {
      return !isFolderInside(folderToMove.value, selectedMoveFolder.value)
    }

    const isInRoot = currentFolderPath.value.length === 1
    if (isInRoot) {
      return false // Cannot move root folders to root (they are already there)
    }
    return true
  }
})

const { sortBy, sortOrder, setSort, sortedFolders, sortedItems } = useMediaSort(
  currentFolders,
  currentItems,
)

onMounted(() => {
  mediaStore.loadRootFolder()
  if (isElectron()) {
    // Show default projection when entering Media Control (close active projection)
    const { setProjectionState } = useProjectionMessaging()
    setProjectionState(true)
  }
})

const contextMenu = useContextMenu()
const backgroundContextMenu = useContextMenu()
const contextMenuTarget = ref<Folder<FileItem> | FileItem | null>(null)

const openBackgroundContextMenu = (event: MouseEvent) => {
  // If drag selection is active, don't open menu
  if (selectionBox.value.isSelecting) return

  // Close item context menu if open
  if (contextMenu.show.value) {
    contextMenu.show.value = false
  }

  backgroundContextMenu.open(event)
}

const openContextMenu = async (target: Folder<FileItem> | FileItem, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  if (!selectedItems.value.has(target.id)) {
    handleSelection(target.id, event)
  }

  // If menu is already open, close it first to ensure a clean transition
  // This resets internal state (like submenu positions) and triggers re-render
  if (contextMenu.show.value) {
    contextMenu.show.value = false
    await nextTick()
  }

  contextMenuTarget.value = target
  contextMenu.open(event)
}

const handleCopy = () => {
  if (selectedItems.value.size === 0) return

  const items: ClipboardItem<FileItem>[] = []
  const currentPath = currentFolderPath.value
  const sourceFolderId =
    currentPath.length > 0 && currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
      ? APP_CONFIG.FOLDER.ROOT_ID
      : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

  selectedItems.value.forEach((id) => {
    const folder = currentFolders.value.find((f) => f.id === id)
    if (folder) {
      items.push({
        type: 'folder',
        data: folder,
        action: 'copy',
        sourceFolderId,
      })
    } else {
      const item = currentItems.value.find((i) => i.id === id)
      if (item) {
        items.push({
          type: 'file',
          data: item,
          action: 'copy',
          sourceFolderId,
        })
      }
    }
  })
  copyToClipboard(items)
  clearSelection()
  showSnackBar(t('fileExplorer.clipboardCopied'), 'info', 3000, 'bottom left')
}

const handleCut = () => {
  if (selectedItems.value.size === 0) return

  const items: ClipboardItem<FileItem>[] = []
  const currentPath = currentFolderPath.value
  const sourceFolderId =
    currentPath.length > 0 && currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
      ? APP_CONFIG.FOLDER.ROOT_ID
      : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

  selectedItems.value.forEach((id) => {
    const folder = currentFolders.value.find((f) => f.id === id)
    if (folder) {
      items.push({
        type: 'folder',
        data: folder,
        action: 'cut',
        sourceFolderId,
      })
    } else {
      const item = currentItems.value.find((i) => i.id === id)
      if (item) {
        items.push({
          type: 'file',
          data: item,
          action: 'cut',
          sourceFolderId,
        })
      }
    }
  })
  cutToClipboard(items)
  clearSelection()
  showSnackBar(t('fileExplorer.clipboardCut'), 'info', 2000, 'bottom left')
}

const handlePaste = () => {
  if (clipboard.value.length === 0) return

  const currentPath = currentFolderPath.value
  const targetFolderId =
    currentPath.length > 0 && currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
      ? APP_CONFIG.FOLDER.ROOT_ID
      : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

  clipboard.value.forEach((clipboardItem) => {
    if (clipboardItem.action === 'copy') {
      const type = clipboardItem.type === 'file' ? 'file' : 'folder'
      const uniqueName = getUniqueName(clipboardItem.data.name, type)

      const itemToPaste = { ...clipboardItem.data, name: uniqueName }

      pasteItem(itemToPaste, targetFolderId, clipboardItem.type === 'file' ? 'verse' : 'folder')
    } else if (clipboardItem.action === 'cut') {
      const type = clipboardItem.type === 'file' ? 'file' : 'folder'

      if (clipboardItem.sourceFolderId !== targetFolderId) {
        const uniqueName = getUniqueName(clipboardItem.data.name, type)

        if (uniqueName !== clipboardItem.data.name) {
          if (type === 'folder') {
            mediaStore.updateFolder(clipboardItem.data.id, { name: uniqueName })
          } else {
            mediaStore.updateItem(clipboardItem.data.id, clipboardItem.sourceFolderId, {
              name: uniqueName,
            })
          }
        }
      }

      if (clipboardItem.type === 'file') {
        moveItemAction(clipboardItem.data as FileItem, targetFolderId, clipboardItem.sourceFolderId)
      } else {
        moveFolderAction(
          clipboardItem.data as Folder<FileItem>,
          targetFolderId,
          clipboardItem.sourceFolderId,
        )
      }
    }
  })

  if (clipboard.value.length > 0 && clipboard.value[0]?.action === 'cut') {
    clipboard.value = []
  }
}

const openCreateFolderDialog = () => {
  folderName.value = ''
  retentionPeriod.value = '1day'
  editingFolderId.value = null
  showFolderDialog.value = true
}

const isDuplicateName = computed(() => {
  if (!folderName.value.trim()) return false

  if (editingType.value === 'file') {
    const fullName = folderName.value.trim() + editingExtension.value
    return currentItems.value.some((i) => {
      if (editingFolderId.value && i.id === editingFolderId.value) return false
      return i.name === fullName
    })
  } else {
    return currentFolders.value.some((f) => {
      if (editingFolderId.value && f.id === editingFolderId.value) return false
      return f.name === folderName.value.trim()
    })
  }
})

const nameErrorMessage = computed(() => {
  if (isDuplicateName.value) {
    return t('fileExplorer.duplicateFolderName')
  }
  return ''
})

const handleSave = async () => {
  if (folderName.value.trim() && !isDuplicateName.value) {
    let expiresAt: number | null = null
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    switch (retentionPeriod.value) {
      case '1day':
        expiresAt = now + oneDay
        break
      case '1week':
        expiresAt = now + oneDay * 7
        break
      case '1month':
        expiresAt = now + oneDay * 30
        break
      case 'permanent':
        expiresAt = null
        break
    }

    if (editingFolderId.value) {
      if (editingType.value === 'folder') {
        mediaStore.updateFolder(editingFolderId.value, {
          name: folderName.value,
          expiresAt: expiresAt,
        })
      } else {
        // Update File
        const fullName = folderName.value.trim() + editingExtension.value
        // Derive parent ID
        const currentPath = currentFolderPath.value
        const parentId =
          currentPath.length > 0 &&
          currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
            ? APP_CONFIG.FOLDER.ROOT_ID
            : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

        mediaStore.updateItem(editingFolderId.value, parentId, {
          name: fullName,
          expiresAt: expiresAt,
        })
      }
    } else {
      // Create New Folder (Files are created via upload)
      mediaStore.addFolderToCurrent(folderName.value, expiresAt)
    }

    showFolderDialog.value = false
    folderName.value = ''
    editingFolderId.value = null
  }
}

// Alias for template
const createFolder = handleSave
const openFolder = (folderId: string) => {
  mediaStore.enterFolder(folderId)
  clearSelection()
}

const lastSelectedId = ref<string | null>(null)

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

const clearSelection = () => {
  selectedItems.value.clear()
}

const editingType = ref<'folder' | 'file'>('folder')
const editingExtension = ref('')

const editItem = (target: Folder<FileItem> | FileItem) => {
  editingFolderId.value = target.id

  if ('items' in target) {
    // Is Folder
    editingType.value = 'folder'
    folderName.value = target.name
    // Retention logic for folder
    if (!target.expiresAt) {
      retentionPeriod.value = 'permanent'
    } else {
      const diff = target.expiresAt - target.timestamp
      const oneDay = 24 * 60 * 60 * 1000
      if (diff > oneDay * 25) retentionPeriod.value = '1month'
      else if (diff > oneDay * 6) retentionPeriod.value = '1week'
      else retentionPeriod.value = '1day'
    }
  } else {
    // Is File
    editingType.value = 'file'
    // Split extension
    const name = target.name
    const lastDot = name.lastIndexOf('.')
    if (lastDot !== -1) {
      folderName.value = name.substring(0, lastDot)
      editingExtension.value = name.substring(lastDot)
    } else {
      folderName.value = name
      editingExtension.value = ''
    }

    // Retention for file (if we want to support editing retention for files too)
    if (!target.expiresAt) {
      retentionPeriod.value = 'permanent'
    } else {
      const diff = target.expiresAt - target.timestamp
      const oneDay = 24 * 60 * 60 * 1000
      if (diff > oneDay * 25) retentionPeriod.value = '1month'
      else if (diff > oneDay * 6) retentionPeriod.value = '1week'
      else retentionPeriod.value = '1day'
    }
  }

  showFolderDialog.value = true
}

// Alias for template compatibility/transition
// editFolder removed in favor of editItem

const confirmDeleteFolder = (folder: Folder<FileItem>) => {
  folderToDelete.value = folder
  showDeleteConfirmDialog.value = true
}

const confirmDeleteItem = (item: FileItem) => {
  itemToDelete.value = item
  showDeleteConfirmDialog.value = true
}

// Drag Selection
const selectionBox = ref({
  isSelecting: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  startX: 0,
  startY: 0,
  initialSelection: new Set<string>(),
})

const onMouseDown = (e: MouseEvent) => {
  // Ignore if clicking on interactive elements
  if (
    (e.target as HTMLElement).closest('.v-btn') ||
    (e.target as HTMLElement).closest('.folder-item') ||
    (e.target as HTMLElement).closest('.file-item') ||
    (e.target as HTMLElement).closest('.v-menu')
  ) {
    return
  }

  // Only allow left click for selection
  if (e.button !== 0) return

  const isMulti = e.ctrlKey || e.metaKey

  selectionBox.value.isSelecting = true
  selectionBox.value.startX = e.clientX
  selectionBox.value.startY = e.clientY
  selectionBox.value.x = e.clientX
  selectionBox.value.y = e.clientY
  selectionBox.value.width = 0
  selectionBox.value.height = 0

  if (isMulti) {
    selectionBox.value.initialSelection = new Set(selectedItems.value)
  } else {
    selectedItems.value.clear()
    selectionBox.value.initialSelection = new Set()
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e: MouseEvent) => {
  if (!selectionBox.value.isSelecting) return

  const currentX = e.clientX
  const currentY = e.clientY

  const x = Math.min(selectionBox.value.startX, currentX)
  const y = Math.min(selectionBox.value.startY, currentY)
  const width = Math.abs(currentX - selectionBox.value.startX)
  const height = Math.abs(currentY - selectionBox.value.startY)

  selectionBox.value.x = x
  selectionBox.value.y = y
  selectionBox.value.width = width
  selectionBox.value.height = height

  if (width < 5 && height < 5) return

  // Intersection check
  const elements = document.querySelectorAll('[data-id]')
  const boxRect = { left: x, top: y, right: x + width, bottom: y + height }

  const newSelected = new Set(selectionBox.value.initialSelection)

  elements.forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (
      rect.left < boxRect.right &&
      rect.right > boxRect.left &&
      rect.top < boxRect.bottom &&
      rect.bottom > boxRect.top
    ) {
      const id = el.getAttribute('data-id')
      if (id) newSelected.add(id)
    }
  })

  selectedItems.value = newSelected
}

const onMouseUp = () => {
  selectionBox.value.isSelecting = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

const handleEsc = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    const isDialogOpen =
      showFolderDialog.value || showMoveDialog.value || showDeleteConfirmDialog.value
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

onMounted(() => {
  document.addEventListener('keydown', handleEsc)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', handleEsc)

  // Reset cut state when leaving the page
  if (clipboard.value.some((item) => item.action === 'cut')) {
    clearClipboard()
  }
})

const confirmDeleteSelected = () => {
  showDeleteConfirmDialog.value = true
}

const confirmDeleteAction = () => {
  if (folderToDelete.value) {
    mediaStore.deleteFolder(folderToDelete.value.id)
    clearSelection()
  } else if (itemToDelete.value) {
    mediaStore.removeItemFromCurrent(itemToDelete.value.id)
    clearSelection()
  } else {
    // Bulk delete
    selectedItems.value.forEach((id) => {
      // Try delete as folder first, then item
      const folder = currentFolders.value.find((f) => f.id === id)
      if (folder) {
        mediaStore.deleteFolder(id)
      } else {
        mediaStore.removeItemFromCurrent(id)
      }
    })
    clearSelection()
  }
  showDeleteConfirmDialog.value = false
  folderToDelete.value = null
  itemToDelete.value = null
}

const uploadFile = () => {
  fileInput.value?.click()
}

const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  for (const file of Array.from(input.files)) {
    // Validate file type
    let fileType: FileItem['metadata']['fileType']
    if (file.type.startsWith('image/')) {
      fileType = 'image'
    } else if (file.type.startsWith('video/')) {
      fileType = 'video'
    } else if (file.type === 'application/pdf') {
      fileType = 'pdf'
    } else {
      // Skip unsupported files
      continue
    }

    try {
      const newItem: FileItem = {
        id: uuidv4(),
        type: 'file',
        name: getUniqueName(file.name, 'file'),
        url: URL.createObjectURL(file), // Default to blob URL for web
        size: file.size,
        timestamp: Date.now(),
        // User Request: Uploaded file should have 1 day retention
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        metadata: {
          fileType,
          mimeType: file.type,
        },
      }

      // ...

      // If in Electron, save file to persistent storage
      if (isElectron()) {
        try {
          // Use useElectron wrapper
          const filePathSource = getFilePath(file)

          if (filePathSource) {
            const { filePath, thumbnailPath } = await saveFile(filePathSource)
            newItem.url = `local-resource://${filePath}`

            if (thumbnailPath) {
              newItem.metadata.thumbnail = `local-resource://${thumbnailPath}`
            }
          }
        } catch (error) {
          console.error('Failed to save file in Electron:', error)
          // Fallback to blob URL is handled by default initialization
        }
      } else {
        showSnackBar(t('fileExplorer.uploadWebWarning'), 'warning', 5000)
      }

      mediaStore.addItemToCurrent(newItem)
    } catch (error) {
      console.error('Failed to process file:', file.name, error)
      showSnackBar(t('fileExplorer.uploadFailed'), 'error')
    }
  }

  // Reset input
  input.value = ''
}

const folderInput = ref<HTMLInputElement | null>(null)

const uploadFolder = () => {
  folderInput.value?.click()
}

const handleFolderUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  // Get directory name from the first file's webkitRelativePath
  // Path format: "RootFolder/SubFolder/File.ext"
  const firstPath = input.files[0]?.webkitRelativePath
  if (!firstPath) return

  const rootFolderName = firstPath.split('/')[0]

  if (!rootFolderName) return

  // Handle Name Collision
  const finalFolderName = getUniqueName(rootFolderName, 'folder')

  // Create Root Folder
  // We use the store action to create the folder in the current view
  // User Request: Default retention for Upload Folder is 1 Day
  const oneDay = 24 * 60 * 60 * 1000
  mediaStore.addFolderToCurrent(finalFolderName, Date.now() + oneDay)

  // Find the folder we just added to get its ID (since we made name unique)
  const createdFolder = currentFolders.value.find((f) => f.name === finalFolderName)
  if (!createdFolder) {
    console.error('Failed to create folder')
    return
  }

  // Upload Files
  for (const file of Array.from(input.files)) {
    // Skip .DS_Store etc
    if (file.name.startsWith('.')) continue

    let fileType: FileItem['metadata']['fileType']
    if (file.type.startsWith('image/')) fileType = 'image'
    else if (file.type.startsWith('video/')) fileType = 'video'
    else if (file.type === 'application/pdf') fileType = 'pdf'
    else continue

    try {
      const newItem: FileItem = {
        id: uuidv4(),
        type: 'file',
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        timestamp: Date.now(),
        metadata: { fileType, mimeType: file.type },
      }

      if (isElectron()) {
        try {
          const filePathSource = getFilePath(file)
          if (filePathSource) {
            const { filePath, thumbnailPath } = await saveFile(filePathSource)
            newItem.url = `local-resource://${filePath}`
            if (thumbnailPath) newItem.metadata.thumbnail = `local-resource://${thumbnailPath}`
          }
        } catch (e) {
          console.error(e)
        }
      }

      // Add to the NEW folder
      mediaStore.addItemToFolder(createdFolder.id, newItem)
    } catch (e) {
      console.error(e)
    }
  }

  // Reset
  input.value = ''
}

const { reorderCurrentItems, reorderCurrentFolders, moveItem, moveFolder, currentFolder } =
  mediaStore

const onDragStart = (event: DragEvent, item: FileItem | Folder<FileItem>) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('itemId', item.id)
    event.dataTransfer.setData('type', 'items' in item ? 'folder' : 'file')
    event.dataTransfer.effectAllowed = 'copyMove'
  }
}

const onDrop = (event: DragEvent, target: FileItem | Folder<FileItem>) => {
  const draggedId = event.dataTransfer?.getData('itemId')
  const draggedType = event.dataTransfer?.getData('type')
  if (!draggedId || !draggedType) return

  const isTargetFolder = 'items' in target
  const targetId = target.id

  if (draggedId === targetId) return

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
    // Perform Move
    const sourceFolderId = currentFolder?.id || APP_CONFIG.FOLDER.ROOT_ID

    if (draggedType === 'file') {
      // Move File -> Folder
      const item = currentItems.value.find((i) => i.id === draggedId)
      if (item) {
        moveItem(item, targetId, sourceFolderId)
        showSnackBar(t('fileExplorer.moveSuccess'), 'success')
      }
    } else {
      // Move Folder -> Folder
      const folder = currentFolders.value.find((f) => f.id === draggedId)
      if (folder && isTargetFolder) {
        // Check recursively? Store handles check
        const success = moveFolder(folder, targetId, currentFolder?.id)
        if (success) {
          showSnackBar(t('fileExplorer.moveSuccess'), 'success')
        } else {
          showSnackBar(t('fileExplorer.moveFailed'), 'error')
        }
      }
    }
  } else {
    // Perform Reorder
    if (draggedType === 'file' && !isTargetFolder) {
      // Reorder Files (File -> File)
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
      // Reorder Folders (Folder -> Folder)
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
  startPresentation(item)
}

// Global Keyboard Shortcuts for Presentation
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'F5') {
    e.preventDefault()
    startPresentation(undefined, e.altKey ? false : true)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

// Move Functions
const openMoveDialog = (target: FileItem | Folder<FileItem>) => {
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null

  // Check if target has 'metadata' property to distinguish FileItem
  if ('metadata' in target && target.metadata) {
    itemToMove.value = target as FileItem
    folderToMove.value = null
    moveType.value = 'file'
  } else {
    folderToMove.value = target as Folder<FileItem>
    itemToMove.value = null
    moveType.value = 'folder'
  }
  showMoveDialog.value = true
}

const openMoveSelectedDialog = () => {
  if (selectedItems.value.size === 0) return
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null
  // For bulk move, we treat it generically, but we need to know generally what we are moving?
  // Actually the loop handled inside confirmMove
  // Just set type to 'file' as default, logic handles mixed
  itemToMove.value = null
  folderToMove.value = null
  moveType.value = 'file' // Default
  showMoveDialog.value = true
}

const navigateMoveToRoot = () => {
  moveBreadcrumb.value = []
  selectedMoveFolder.value = null
}

const navigateMoveToFolder = (folderId: string) => {
  const folder = getFolderById(folderId)
  if (folder) {
    const index = moveBreadcrumb.value.indexOf(folderId)
    const newPath = index !== -1 ? moveBreadcrumb.value.slice(0, index + 1) : moveBreadcrumb.value
    moveBreadcrumb.value = newPath
    selectedMoveFolder.value = folder
  }
}

const selectMoveTarget = (target: Folder<FileItem>) => {
  const folder = getFolderById(target.id)
  if (folder) {
    moveBreadcrumb.value = [...moveBreadcrumb.value, target.id]
    selectedMoveFolder.value = folder
  }
}

const getMoveFolderTargets = (): Folder<FileItem>[] => {
  const excludeFolderId =
    moveType.value === 'folder' && folderToMove.value ? folderToMove.value.id : undefined
  return getMoveTargets(selectedMoveFolder.value, excludeFolderId)
}

useKeyboardShortcuts({
  onCopy: handleCopy,
  onCut: handleCut,
  onPaste: handlePaste,
  onDelete: confirmDeleteSelected,
})

const confirmMove = () => {
  const currentPath = currentFolderPath.value
  const sourceFolderId =
    currentPath.length > 0 && currentPath[currentPath.length - 1] === APP_CONFIG.FOLDER.ROOT_ID
      ? APP_CONFIG.FOLDER.ROOT_ID
      : currentPath[currentPath.length - 1] || APP_CONFIG.FOLDER.ROOT_ID

  const targetFolderId = selectedMoveFolder.value
    ? selectedMoveFolder.value.id
    : APP_CONFIG.FOLDER.ROOT_ID

  if (itemToMove.value) {
    moveItemAction(itemToMove.value, targetFolderId, sourceFolderId)
    clearSelection() // If single item selected via menu but also in selection
  } else if (folderToMove.value) {
    moveFolderAction(folderToMove.value, targetFolderId, sourceFolderId)
    clearSelection()
  } else if (selectedItems.value.size > 0) {
    // Bulk move
    selectedItems.value.forEach((id) => {
      // Try to find as folder
      const folder = currentFolders.value.find((f) => f.id === id)
      if (folder) {
        // Prevent moving into self or child
        if (selectedMoveFolder.value && isFolderInside(folder, selectedMoveFolder.value)) {
          console.warn(`Cannot move folder ${folder.name} into its own child`)
          return
        }
        // Prevent moving to same folder (root to root is blocked by canMoveToRoot if single, but here we iterate)
        if (sourceFolderId === targetFolderId) return

        moveFolderAction(folder, targetFolderId, sourceFolderId)
      } else {
        // Assume file
        const item = currentItems.value.find((i) => i.id === id)
        if (item) {
          if (sourceFolderId === targetFolderId) return
          moveItemAction(item, targetFolderId, sourceFolderId)
        }
      }
    })
    clearSelection()
  }

  showMoveDialog.value = false
  itemToMove.value = null
  folderToMove.value = null
  selectedMoveFolder.value = null
}
</script>

<style scoped>
.hover-bg-grey-darken-2:hover {
  background-color: rgba(var(--v-theme-primary), 0.3) !important;
}
.user-select-none {
  user-select: none;
}
.item-cut {
  opacity: 0.5;
}
.selection-box {
  position: fixed;
  background: rgba(var(--v-theme-primary), 0.2);
  border: 1px solid rgba(var(--v-theme-primary), 0.5);
  pointer-events: none;
  z-index: 9999;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
