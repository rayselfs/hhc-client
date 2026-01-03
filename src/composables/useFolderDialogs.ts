import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Folder, FileItem, VerseItem, FolderItem } from '@/types/common'

type ItemType = FileItem | VerseItem

export interface UseFolderDialogsReturn<T extends FolderItem> {
  // Create/Edit
  showFolderDialog: Ref<boolean>
  folderName: Ref<string>
  retentionPeriod: Ref<string>
  editingFolderId: Ref<string | null>
  editingType: Ref<string>
  editingExtension: Ref<string>
  retentionOptions: ComputedRef<{ title: string; value: string }[]>
  openCreateFolderDialog: (initialName?: string) => void
  openEditDialog: (target: Folder<T> | T) => void

  // Delete
  showDeleteConfirmDialog: Ref<boolean>
  folderToDelete: Ref<Folder<T> | null>
  itemToDelete: Ref<T | null>
  openDeleteFolderDialog: (folder: Folder<T>) => void
  openDeleteItemDialog: (item: T) => void
  openDeleteSelectionDialog: () => void

  // Move
  showMoveDialog: Ref<boolean>
  moveBreadcrumb: Ref<{ id: string; name: string }[]>
  selectedMoveFolder: Ref<Folder<T> | null>
  moveSelection: Ref<Set<string>>
  moveType: Ref<string>
  folderToMove: Ref<Folder<T> | null>
  itemToMove: Ref<T | null>
  openMoveDialog: (target: T | Folder<T>) => void
  openMoveSelectedDialog: (selectedIds: Set<string>) => void
}

export function useFolderDialogs<T extends FolderItem = ItemType>(): UseFolderDialogsReturn<T> {
  const { t } = useI18n()

  // --- Create / Edit Folder Dialog ---
  const showFolderDialog = ref(false)
  const folderName = ref('')
  const retentionPeriod = ref('1day')
  const editingFolderId = ref<string | null>(null)
  const editingType = ref<string>('folder') // 'folder' | 'file' | 'verse' | ...
  const editingExtension = ref('')

  const retentionOptions = computed(() => [
    { title: t('fileExplorer.retention.1day'), value: '1day' },
    { title: t('fileExplorer.retention.1week'), value: '1week' },
    { title: t('fileExplorer.retention.1month'), value: '1month' },
    { title: t('fileExplorer.retention.permanent'), value: 'permanent' },
  ])

  const openCreateFolderDialog = (initialName?: string) => {
    folderName.value = initialName || ''
    retentionPeriod.value = '1day'
    editingFolderId.value = null
    editingType.value = 'folder'
    showFolderDialog.value = true
  }

  const openEditDialog = (target: Folder<T> | T) => {
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
      // Is Item (File or Verse)
      editingType.value = 'file'

      const name = 'name' in target ? (target as { name: string }).name : ''

      const lastDot = name.lastIndexOf('.')
      if (lastDot !== -1) {
        folderName.value = name.substring(0, lastDot)
        editingExtension.value = name.substring(lastDot)
      } else {
        folderName.value = name
        editingExtension.value = ''
      }

      // Retention for item
      if (!target.expiresAt) {
        retentionPeriod.value = 'permanent'
      } else {
        const diff = target.expiresAt - target.timestamp // Assuming timestamp exists
        const oneDay = 24 * 60 * 60 * 1000
        if (diff > oneDay * 25) retentionPeriod.value = '1month'
        else if (diff > oneDay * 6) retentionPeriod.value = '1week'
        else retentionPeriod.value = '1day'
      }
    }

    showFolderDialog.value = true
  }

  // --- Delete Dialog ---
  const showDeleteConfirmDialog = ref(false)
  const folderToDelete = ref<Folder<T> | null>(null) as Ref<Folder<T> | null>
  const itemToDelete = ref<T | null>(null) as Ref<T | null>

  const openDeleteFolderDialog = (folder: Folder<T>) => {
    folderToDelete.value = folder
    itemToDelete.value = null
    showDeleteConfirmDialog.value = true
  }

  const openDeleteItemDialog = (item: T) => {
    itemToDelete.value = item
    folderToDelete.value = null
    showDeleteConfirmDialog.value = true
  }

  const openDeleteSelectionDialog = () => {
    folderToDelete.value = null
    itemToDelete.value = null
    showDeleteConfirmDialog.value = true
  }

  // --- Move Dialog ---
  const showMoveDialog = ref(false)
  const moveBreadcrumb = ref<{ id: string; name: string }[]>([])
  const selectedMoveFolder = ref<Folder<T> | null>(null) as Ref<Folder<T> | null>
  const moveSelection = ref<Set<string>>(new Set())
  const moveType = ref<string>('file')
  const folderToMove = ref<Folder<T> | null>(null) as Ref<Folder<T> | null>
  const itemToMove = ref<T | null>(null) as Ref<T | null>

  const openMoveDialog = (target: T | Folder<T>) => {
    moveBreadcrumb.value = []
    moveSelection.value.clear()
    moveSelection.value.add(target.id)
    selectedMoveFolder.value = null

    if ('items' in target) {
      folderToMove.value = target as Folder<T>
      itemToMove.value = null
      moveType.value = 'folder'
    } else {
      folderToMove.value = null
      itemToMove.value = target as T
      moveType.value = 'file'
    }
    showMoveDialog.value = true
  }

  const openMoveSelectedDialog = (selectedIds: Set<string>) => {
    moveBreadcrumb.value = []
    moveSelection.value = new Set(selectedIds)
    folderToMove.value = null
    itemToMove.value = null
    selectedMoveFolder.value = null
    showMoveDialog.value = true
  }

  return {
    // Create/Edit
    showFolderDialog,
    folderName,
    retentionPeriod,
    editingFolderId,
    editingType,
    editingExtension,
    retentionOptions,
    openCreateFolderDialog,
    openEditDialog,

    // Delete
    showDeleteConfirmDialog,
    folderToDelete,
    itemToDelete,
    openDeleteFolderDialog,
    openDeleteItemDialog,
    openDeleteSelectionDialog,

    // Move
    showMoveDialog,
    moveBreadcrumb,
    selectedMoveFolder,
    moveSelection,
    moveType,
    folderToMove,
    itemToMove,
    openMoveDialog,
    openMoveSelectedDialog,
  }
}
