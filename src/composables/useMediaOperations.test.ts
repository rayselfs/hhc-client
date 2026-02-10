import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import { useMediaOperations } from './useMediaOperations'
import { useMediaFolderStore } from '@/stores/folder'
import { createPinia, setActivePinia } from 'pinia'
import type { UseFolderDialogsReturn } from './useFolderDialogs'
import type { FileItem, Folder } from '@/types/common'
import { MediaFolder } from '@/types/enum'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/composables/useSentry', () => ({
  useSentry: () => ({
    reportError: vi.fn(),
  }),
}))

vi.mock('@/composables/useSnackBar', () => ({
  useSnackBar: () => ({
    showSnackBar: vi.fn(),
  }),
}))

vi.mock('@/composables/useFileSystem', () => ({
  useFileSystem: () => ({
    isElectron: ref(false),
    getFilePath: vi.fn(),
    saveFile: vi.fn(),
    deletePhysicalFilesRecursive: vi.fn(),
    canEdit: vi.fn(() => true),
    copyFile: vi.fn(() => ({ success: true, data: { fileUrl: 'copied-url' } })),
  }),
}))

vi.mock('@/composables/useIndexedDB', () => ({
  useIndexedDB: () => ({
    put: vi.fn(),
    get: vi.fn(),
  }),
}))

vi.mock('@/composables/useElectron', () => ({
  useElectron: () => ({
    isElectron: vi.fn(() => false),
    ffmpegCheckStatus: vi.fn(async () => ({ available: true })),
  }),
}))

vi.mock('./usePdfProcessing', () => ({
  processPdfFile: vi.fn(async () => ({
    pageCount: 5,
    thumbnail: null,
  })),
}))

describe('useMediaOperations', () => {
  let mediaStore: ReturnType<typeof useMediaFolderStore>
  let dialogs: UseFolderDialogsReturn<FileItem>
  let selectedItems: { value: Set<string>; clear: () => void }

  beforeEach(() => {
    setActivePinia(createPinia())
    mediaStore = useMediaFolderStore()

    dialogs = {
      showFolderDialog: ref(false),
      folderName: ref(''),
      retentionPeriod: ref('1day'),
      retentionOptions: computed(() => [
        { title: '1 day', value: '1day' },
        { title: '1 week', value: '1week' },
        { title: '1 month', value: '1month' },
        { title: 'Permanent', value: 'permanent' },
      ]),
      editingFolderId: ref(null),
      editingType: ref('folder'),
      editingExtension: ref(''),
      showDeleteConfirmDialog: ref(false),
      folderToDelete: ref<Folder<FileItem> | null>(null),
      itemToDelete: ref<FileItem | null>(null),
      showMoveDialog: ref(false),
      moveBreadcrumb: ref([]),
      selectedMoveFolder: ref<Folder<FileItem> | null>(null),
      moveSelection: ref(new Set<string>()),
      moveType: ref('file'),
      folderToMove: ref<Folder<FileItem> | null>(null),
      itemToMove: ref<FileItem | null>(null),
      openCreateFolderDialog: vi.fn(),
      openEditDialog: vi.fn(),
      openDeleteFolderDialog: vi.fn(),
      openDeleteItemDialog: vi.fn(),
      openDeleteSelectionDialog: vi.fn(),
      openMoveDialog: vi.fn(),
      openMoveSelectedDialog: vi.fn(),
    }

    selectedItems = {
      value: new Set<string>(),
      clear: vi.fn(() => selectedItems.value.clear()),
    }
  })

  describe('External API - Return Signature', () => {
    it('should return all expected operations', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      expect(operations).toHaveProperty('isDuplicateName')
      expect(operations).toHaveProperty('nameErrorMessage')
      expect(operations).toHaveProperty('handleSave')
      expect(operations).toHaveProperty('confirmDeleteAction')
      expect(operations).toHaveProperty('handleCopy')
      expect(operations).toHaveProperty('handleCut')
      expect(operations).toHaveProperty('handlePaste')
      expect(operations).toHaveProperty('handlePasteIntoFolder')
      expect(operations).toHaveProperty('getUniqueName')
      expect(operations).toHaveProperty('canProjectItem')
      expect(operations).toHaveProperty('updateFfmpegStatus')
      expect(operations).toHaveProperty('isFfmpegEnabled')
      expect(operations).toHaveProperty('fileInput')
      expect(operations).toHaveProperty('folderInput')
      expect(operations).toHaveProperty('uploadFile')
      expect(operations).toHaveProperty('uploadFolder')
      expect(operations).toHaveProperty('handleFileChange')
      expect(operations).toHaveProperty('handleFolderUpload')
      expect(operations).toHaveProperty('isNameExists')
      expect(operations).toHaveProperty('sortBy')
      expect(operations).toHaveProperty('sortOrder')
      expect(operations).toHaveProperty('setSort')
      expect(operations).toHaveProperty('sortedFolders')
      expect(operations).toHaveProperty('sortedItems')
      expect(operations).toHaveProperty('sortedUnifiedItems')
      expect(operations).toHaveProperty('handleMove')
      expect(operations).toHaveProperty('handleReorder')
    })
  })

  describe('Sorting Logic', () => {
    it('should initialize with default sort settings', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      expect(operations.sortBy.value).toBe('name')
      expect(operations.sortOrder.value).toBe('asc')
    })

    it('should toggle sort order when clicking same sort type', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      operations.setSort('name')
      expect(operations.sortOrder.value).toBe('desc')

      operations.setSort('name')
      expect(operations.sortOrder.value).toBe('none')

      operations.setSort('name')
      expect(operations.sortOrder.value).toBe('asc')
    })

    it('should reset to asc when switching sort type', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      operations.setSort('name')
      operations.setSort('name')
      operations.setSort('date')

      expect(operations.sortBy.value).toBe('date')
      expect(operations.sortOrder.value).toBe('asc')
    })
  })

  describe('Upload Logic', () => {
    it('should expose file and folder input refs', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      expect(operations.fileInput.value).toBeNull()
      expect(operations.folderInput.value).toBeNull()
    })

    it('should provide getUniqueName for conflict resolution', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      mediaStore.addFolderToCurrent('TestFolder', null)

      const uniqueName = operations.getUniqueName('TestFolder', 'folder')
      expect(uniqueName).toBe('TestFolder 2')
    })

    it('should generate unique names with incrementing counter', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      mediaStore.addFolderToCurrent('Folder', null)
      mediaStore.addFolderToCurrent('Folder 2', null)

      const uniqueName = operations.getUniqueName('Folder', 'folder')
      expect(uniqueName).toBe('Folder 3')
    })

    it('should preserve file extension when generating unique names', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const mockFile: FileItem = {
        id: 'file1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'image.jpg',
        url: 'url',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'image' },
        sourceType: 'local',
      }
      mediaStore.addItemToCurrent(mockFile)

      const uniqueName = operations.getUniqueName('image.jpg', 'file')
      expect(uniqueName).toBe('image 2.jpg')
    })
  })

  describe('Clipboard Operations', () => {
    it('should handle copy operation', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const mockFile: FileItem = {
        id: 'file1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test.jpg',
        url: 'url',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'image' },
        sourceType: 'local',
      }
      mediaStore.addItemToCurrent(mockFile)
      selectedItems.value.add('file1')

      operations.handleCopy()

      expect(mediaStore.clipboard.length).toBe(1)
      expect(mediaStore.clipboard[0]?.action).toBe('copy')
      expect(selectedItems.value.size).toBe(0)
    })

    it('should handle cut operation', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const mockFile: FileItem = {
        id: 'file1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test.jpg',
        url: 'url',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'image' },
        sourceType: 'local',
      }
      mediaStore.addItemToCurrent(mockFile)
      selectedItems.value.add('file1')

      operations.handleCut()

      expect(mediaStore.clipboard.length).toBe(1)
      expect(mediaStore.clipboard[0]?.action).toBe('cut')
      expect(selectedItems.value.size).toBe(0)
    })
  })

  describe('Delete Operations', () => {
    it('should delete single item', async () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const mockFile: FileItem = {
        id: 'file1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test.jpg',
        url: 'url',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'image' },
        sourceType: 'local',
      }
      mediaStore.addItemToCurrent(mockFile)
      dialogs.itemToDelete.value = mockFile

      await operations.confirmDeleteAction()

      expect(mediaStore.getCurrentItems.length).toBe(0)
    })

    it('should delete multiple selected items', async () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const mockFile1: FileItem = {
        id: 'file1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test1.jpg',
        url: 'url1',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'image' },
        sourceType: 'local',
      }
      const mockFile2: FileItem = {
        id: 'file2',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test2.jpg',
        url: 'url2',
        size: 2000,
        timestamp: Date.now(),
        metadata: { fileType: 'image' },
        sourceType: 'local',
      }

      mediaStore.addItemToCurrent(mockFile1)
      mediaStore.addItemToCurrent(mockFile2)
      selectedItems.value.add('file1')
      selectedItems.value.add('file2')

      await operations.confirmDeleteAction()

      expect(mediaStore.getCurrentItems.length).toBe(0)
    })
  })

  describe('FFmpeg Projectability', () => {
    it('should allow projection of image files', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const imageFile: FileItem = {
        id: 'img1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test.jpg',
        url: 'url',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'image' },
        sourceType: 'local',
      }

      expect(operations.canProjectItem(imageFile)).toBe(true)
    })

    it('should allow projection of PDF files', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const pdfFile: FileItem = {
        id: 'pdf1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test.pdf',
        url: 'url',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'pdf' },
        sourceType: 'local',
      }

      expect(operations.canProjectItem(pdfFile)).toBe(true)
    })

    it('should allow projection of native video files', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      const videoFile: FileItem = {
        id: 'vid1',
        type: 'file',
        folderId: MediaFolder.ROOT_ID,
        name: 'test.mp4',
        url: 'url',
        size: 1000,
        timestamp: Date.now(),
        metadata: { fileType: 'video' },
        sourceType: 'local',
      }

      expect(operations.canProjectItem(videoFile)).toBe(true)
    })
  })

  describe('Duplicate Name Detection', () => {
    it('should detect duplicate folder names', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      mediaStore.addFolderToCurrent('ExistingFolder', null)
      dialogs.folderName.value = 'ExistingFolder'
      dialogs.editingType.value = 'folder'

      expect(operations.isDuplicateName.value).toBe(true)
      expect(operations.nameErrorMessage.value).toBe('fileExplorer.duplicateFolderName')
    })

    it('should not detect duplicate when editing same item', () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      mediaStore.addFolderToCurrent('TestFolder', null)
      const folder = mediaStore.getCurrentFolders[0]

      dialogs.folderName.value = 'TestFolder'
      dialogs.editingType.value = 'folder'
      dialogs.editingFolderId.value = folder?.id || null

      expect(operations.isDuplicateName.value).toBe(false)
    })
  })

  describe('Folder Creation and Update', () => {
    it('should create folder with retention period', async () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      dialogs.folderName.value = 'NewFolder'
      dialogs.retentionPeriod.value = '1week'

      await operations.handleSave()

      const folders = mediaStore.getCurrentFolders
      expect(folders.length).toBe(1)
      expect(folders[0]?.name).toBe('NewFolder')
      expect(folders[0]?.expiresAt).toBeTruthy()
    })

    it('should create permanent folder when retention is permanent', async () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      dialogs.folderName.value = 'PermanentFolder'
      dialogs.retentionPeriod.value = 'permanent'

      await operations.handleSave()

      const folders = mediaStore.getCurrentFolders
      expect(folders[0]?.expiresAt).toBeNull()
    })

    it('should update existing folder name', async () => {
      const operations = useMediaOperations(mediaStore, dialogs, selectedItems)

      mediaStore.addFolderToCurrent('OldName', null)
      const folder = mediaStore.getCurrentFolders[0]

      dialogs.editingFolderId.value = folder?.id || null
      dialogs.editingType.value = 'folder'
      dialogs.folderName.value = 'NewName'
      dialogs.retentionPeriod.value = '1day'

      await operations.handleSave()

      const updatedFolder = mediaStore.getCurrentFolders[0]
      expect(updatedFolder?.name).toBe('NewName')
    })
  })
})
