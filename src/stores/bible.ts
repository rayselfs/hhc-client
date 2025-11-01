import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import type {
  MultiFunctionVerse,
  BibleCacheItem,
  BibleContent,
  CustomFolder,
  CurrentPassage,
  BibleBook,
} from '@/types/bible'
import { BibleCacheConfig } from '@/types/bible'
import { useIndexedDB } from '@/composables/useIndexedDB'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { BIBLE_CONFIG } from '@/config/app'
import { v4 as uuidv4 } from 'uuid'

export const useBibleStore = defineStore('bible', () => {
  // ==================== History ====================
  const historyVerses = ref<MultiFunctionVerse[]>([])

  // ==================== Custom Folders ====================
  const customFolders = ref<CustomFolder[]>([])
  const currentFolderPath = ref<string[]>([]) // 當前資料夾路徑
  const currentFolder = ref<CustomFolder | null>(null) // 當前所在的資料夾

  // ==================== Selected Version ====================
  const selectedVersionId = ref<number | null>(null)

  // ==================== Current Passage ====================
  const currentPassage = ref<CurrentPassage | null>(null)

  // ==================== IndexedDB ====================
  const bibleCacheDB = useIndexedDB({
    dbName: BibleCacheConfig.DB_NAME as string,
    version: BibleCacheConfig.DB_VERSION as number,
    stores: [
      {
        name: BibleCacheConfig.STORE_NAME as string,
        keyPath: 'versionId',
      },
    ],
  })

  // ==================== LocalStorage ====================
  const { getLocalItem, setLocalItem } = useLocalStorage()

  /**
   * Add verse to history
   */
  const addToHistory = (verse: MultiFunctionVerse) => {
    // Check if the verse already exists in the history
    const existingIndex = historyVerses.value.findIndex(
      (item) =>
        item.bookNumber === verse.bookNumber &&
        item.chapter === verse.chapter &&
        item.verse === verse.verse,
    )

    if (existingIndex !== -1) {
      // If it already exists, remove the old record
      historyVerses.value.splice(existingIndex, 1)
    }

    // Add new record to the beginning
    historyVerses.value.unshift(verse)

    // Limit the history record count (maximum 50 records)
    if (historyVerses.value.length > 50) {
      historyVerses.value.shift()
    }
  }

  /**
   * Clear history
   */
  const clearHistory = () => {
    historyVerses.value = []
  }

  // ==================== Bible Content Cache Actions ====================

  /**
   * Save Bible content to IndexedDB
   * @param versionId - version ID
   * @param versionCode - version code
   * @param versionName - version name
   * @param content - Bible content
   */
  const saveBibleContent = async (
    versionId: number,
    versionCode: string,
    versionName: string,
    content: BibleContent,
  ): Promise<void> => {
    await bibleCacheDB.put<BibleCacheItem>(BibleCacheConfig.STORE_NAME, {
      versionId,
      versionCode,
      versionName,
      content,
      timestamp: Date.now(),
    })
  }

  /**
   * Get Bible content from IndexedDB
   * @param versionId - version ID
   * @returns Bible content, if not exists, return null
   */
  const getBibleContent = async (versionId: number): Promise<BibleContent | null> => {
    const cached = await bibleCacheDB.get<BibleCacheItem>(BibleCacheConfig.STORE_NAME, versionId)
    return cached?.content ?? null
  }

  /**
   * Check if the Bible content for a specific version is cached
   * @param versionId - version ID
   * @returns true if cached, false otherwise
   */
  const hasCachedContent = async (versionId: number): Promise<boolean> => {
    return await bibleCacheDB.has(BibleCacheConfig.STORE_NAME, versionId)
  }

  // ==================== Selected Version Actions ====================

  /**
   * Load selected version from LocalStorage
   */
  const loadSelectedVersion = () => {
    const saved = getLocalItem<number | null>(
      getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION),
      'int',
    )
    if (saved) {
      selectedVersionId.value = saved
    }
  }

  /**
   * Set selected version and save to LocalStorage
   * @param versionId - version ID
   */
  const setSelectedVersion = (versionId: number) => {
    selectedVersionId.value = versionId
    setLocalItem(getStorageKey(StorageCategory.BIBLE, StorageKey.SELECTED_VERSION), versionId)
  }

  // ==================== Custom Folders Actions ====================

  /**
   * Load custom folders from LocalStorage
   */
  const loadCustomFolders = () => {
    const saved = getLocalItem<CustomFolder[]>(
      getStorageKey(StorageCategory.BIBLE, StorageKey.CUSTOM_FOLDERS),
      'array',
    )
    if (saved) {
      customFolders.value = saved
    }
  }

  /**
   * Save custom folders to LocalStorage
   */
  const saveCustomFolders = () => {
    setLocalItem(
      getStorageKey(StorageCategory.BIBLE, StorageKey.CUSTOM_FOLDERS),
      customFolders.value,
      'array',
    )
  }

  /**
   * Navigate to root (homepage)
   */
  const navigateToRoot = () => {
    currentFolderPath.value = []
    currentFolder.value = null
  }

  /**
   * Navigate to specific folder
   * @param folderId - folder ID
   */
  const navigateToFolder = (folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      const index = currentFolderPath.value.indexOf(folderId)
      const newPath =
        index !== -1 ? currentFolderPath.value.slice(0, index + 1) : currentFolderPath.value
      currentFolderPath.value = newPath
      currentFolder.value = folder
    }
  }

  /**
   * Enter folder (add to path)
   * @param folderId - folder ID
   */
  const enterFolder = (folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      currentFolderPath.value = [...currentFolderPath.value, folderId]
      currentFolder.value = folder

      // 清除文字選擇，防止資料夾名稱被反白
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges()
      }
    }
  }

  /**
   * Get folder by ID
   * @param folderId - folder ID
   */
  const getFolderById = (folderId: string): CustomFolder | null => {
    for (const folder of customFolders.value) {
      if (folder.id === folderId) return folder
      const found = findFolderInTree(folder, folderId)
      if (found) return found
    }
    return null
  }

  /**
   * Find folder in tree recursively
   * @param folder - folder to search in
   * @param folderId - target folder ID
   */
  const findFolderInTree = (folder: CustomFolder, folderId: string): CustomFolder | null => {
    for (const subFolder of folder.folders) {
      if (subFolder.id === folderId) return subFolder
      const found = findFolderInTree(subFolder, folderId)
      if (found) return found
    }
    return null
  }

  /**
   * Get current folders (subfolders of current folder or root folders)
   */
  const getCurrentFolders = (): CustomFolder[] => {
    if (currentFolder.value) {
      // 如果在資料夾中，返回該資料夾的子資料夾
      return currentFolder.value.folders
    } else {
      // 如果在 Homepage，返回所有資料夾（除了 Homepage 資料夾本身）
      return customFolders.value.filter((folder) => folder.id !== BIBLE_CONFIG.FOLDER.HOMEPAGE_ID)
    }
  }

  /**
   * Get current verses (verses in current folder or homepage)
   */
  const getCurrentVerses = (): MultiFunctionVerse[] => {
    if (currentFolder.value) {
      // 如果在資料夾中，返回該資料夾的經文
      return currentFolder.value.items
    } else {
      // 如果在 Homepage，返回 Homepage 資料夾的經文
      const homepageFolder = customFolders.value.find(
        (folder) => folder.id === BIBLE_CONFIG.FOLDER.HOMEPAGE_ID,
      )
      return homepageFolder ? homepageFolder.items : []
    }
  }

  /**
   * Create new folder
   * @param name - folder name
   * @param parentId - parent folder ID (optional)
   */
  const createFolder = (name: string, parentId?: string) => {
    const newFolder: CustomFolder = {
      id: uuidv4(),
      name: name.trim(),
      expanded: false,
      items: [],
      folders: [],
      parentId: parentId || currentFolder.value?.id,
    }

    if (currentFolder.value) {
      updateFolderInTree(currentFolder.value.id, (folder) => {
        folder.folders.push(newFolder)
      })
    } else {
      customFolders.value.push(newFolder)
    }

    saveCustomFolders()
  }

  /**
   * Delete folder recursively
   * @param folderId - folder ID to delete
   */
  const deleteFolder = (folderId: string) => {
    deleteFolderRecursive(customFolders.value, folderId)
    // 如果刪除的是當前資料夾，導航回根目錄
    if (currentFolder.value?.id === folderId) {
      navigateToRoot()
    }
    saveCustomFolders()
  }

  /**
   * Delete folder recursively helper
   */
  const deleteFolderRecursive = (folders: CustomFolder[], id: string): boolean => {
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i]
      if (folder && folder.id === id) {
        folders.splice(i, 1)
        return true
      }
      if (folder && folder.folders && deleteFolderRecursive(folder.folders, id)) {
        return true
      }
    }
    return false
  }

  /**
   * Add verse to current folder or homepage
   * @param verse - verse to add
   */
  const addVerseToFolder = (verse: MultiFunctionVerse) => {
    if (currentFolder.value) {
      // 檢查是否已存在相同的經文
      const exists = currentFolder.value.items.some(
        (item) =>
          item.bookNumber === verse.bookNumber &&
          item.chapter === verse.chapter &&
          item.verse === verse.verse,
      )
      if (!exists) {
        currentFolder.value.items.push(verse)
      }
    } else {
      // 添加到 Homepage
      let homepageFolder = customFolders.value.find(
        (folder) => folder.id === BIBLE_CONFIG.FOLDER.HOMEPAGE_ID,
      )

      if (!homepageFolder) {
        homepageFolder = {
          id: BIBLE_CONFIG.FOLDER.HOMEPAGE_ID,
          name: BIBLE_CONFIG.FOLDER.DEFAULT_HOMEPAGE_NAME,
          expanded: false,
          items: [],
          folders: [],
        }
        customFolders.value.push(homepageFolder)
      }

      const exists = homepageFolder.items.some(
        (item) =>
          item.bookNumber === verse.bookNumber &&
          item.chapter === verse.chapter &&
          item.verse === verse.verse,
      )
      if (!exists) {
        homepageFolder.items.push(verse)
      }
    }
    saveCustomFolders()
  }

  /**
   * Remove verse from current folder
   * @param itemId - verse ID to remove
   */
  const removeVerseFromFolder = (itemId: string) => {
    if (currentFolder.value) {
      updateFolderInTree(currentFolder.value.id, (folder) => {
        folder.items = folder.items.filter((item) => item.id !== itemId)
      })
    } else {
      // 從 Homepage 資料夾中移除
      const homepageFolder = customFolders.value.find(
        (folder) => folder.id === BIBLE_CONFIG.FOLDER.HOMEPAGE_ID,
      )
      if (homepageFolder) {
        homepageFolder.items = homepageFolder.items.filter((item) => item.id !== itemId)
      }
    }
    saveCustomFolders()
  }

  /**
   * Update folder in tree helper
   * @param targetFolderId - target folder ID
   * @param callback - callback function to update folder
   */
  const updateFolderInTree = (
    targetFolderId: string,
    callback: (folder: CustomFolder) => void,
  ): boolean => {
    for (const folder of customFolders.value) {
      if (folder.id === targetFolderId) {
        callback(folder)
        return true
      }
      if (updateFolderInTreeRecursive(folder.folders, targetFolderId, callback)) {
        return true
      }
    }
    return false
  }

  /**
   * Update folder in tree recursive helper
   */
  const updateFolderInTreeRecursive = (
    folders: CustomFolder[],
    targetFolderId: string,
    callback: (folder: CustomFolder) => void,
  ): boolean => {
    for (const folder of folders) {
      if (folder.id === targetFolderId) {
        callback(folder)
        return true
      }
      if (updateFolderInTreeRecursive(folder.folders, targetFolderId, callback)) {
        return true
      }
    }
    return false
  }

  /**
   * Move verse to another folder
   * @param verse - verse to move
   * @param targetFolderId - target folder ID (null for homepage)
   */
  const moveVerseToFolder = (verse: MultiFunctionVerse, targetFolderId: string | null) => {
    // 從原位置移除
    if (currentFolder.value) {
      updateFolderInTree(currentFolder.value.id, (folder) => {
        folder.items = folder.items.filter((item) => item.id !== verse.id)
      })
    } else {
      const homepageFolder = customFolders.value.find(
        (folder) => folder.id === BIBLE_CONFIG.FOLDER.HOMEPAGE_ID,
      )
      if (homepageFolder) {
        homepageFolder.items = homepageFolder.items.filter((item) => item.id !== verse.id)
      }
    }

    // 添加到目標位置
    if (targetFolderId) {
      updateFolderInTree(targetFolderId, (folder) => {
        folder.items.push(verse)
      })
    } else {
      // 移動到首頁
      let homepageFolder = customFolders.value.find(
        (folder) => folder.id === BIBLE_CONFIG.FOLDER.HOMEPAGE_ID,
      )
      if (!homepageFolder) {
        homepageFolder = {
          id: BIBLE_CONFIG.FOLDER.HOMEPAGE_ID,
          name: BIBLE_CONFIG.FOLDER.DEFAULT_HOMEPAGE_NAME,
          expanded: false,
          items: [],
          folders: [],
        }
        customFolders.value.push(homepageFolder)
      }
      homepageFolder.items.push(verse)
    }

    saveCustomFolders()
  }

  /**
   * Paste verse/item to current folder
   * @param verse - verse to paste
   * @param folder - folder to paste (optional, for folder copy)
   */
  const pasteItem = async (verse?: MultiFunctionVerse, folder?: CustomFolder) => {
    if (verse) {
      const newVerse = { ...verse, id: uuidv4() } as MultiFunctionVerse
      addVerseToFolder(newVerse)
    } else if (folder) {
      const newFolder = {
        ...folder,
        id: uuidv4(),
        items: [...folder.items],
        folders: [...folder.folders],
      }

      if (currentFolder.value) {
        updateFolderInTree(currentFolder.value.id, (targetFolder) => {
          targetFolder.folders.push(newFolder)
        })
      } else {
        customFolders.value.push(newFolder)
      }
      saveCustomFolders()
    }
  }

  /**
   * Move folder to another folder
   * @param folderToMove - folder to move
   * @param targetFolderId - target folder ID
   */
  const moveFolderToFolder = (folderToMove: CustomFolder, targetFolderId: string) => {
    // 從原位置移除
    if (currentFolder.value) {
      updateFolderInTree(currentFolder.value.id, (folder) => {
        folder.folders = folder.folders.filter((f) => f.id !== folderToMove.id)
      })
    } else {
      // 從根目錄移除
      const index = customFolders.value.findIndex((f) => f.id === folderToMove.id)
      if (index !== -1) {
        customFolders.value.splice(index, 1)
      }
    }

    // 添加到目標資料夾
    updateFolderInTree(targetFolderId, (folder) => {
      folderToMove.parentId = folder.id
      folder.folders.push(folderToMove)
    })

    saveCustomFolders()
  }

  /**
   * Check if folder is inside another folder
   */
  const isFolderInside = (folderToMove: CustomFolder, targetFolder: CustomFolder): boolean => {
    if (folderToMove.id === targetFolder.id) return true

    for (const subFolder of targetFolder.folders) {
      if (isFolderInside(folderToMove, subFolder)) {
        return true
      }
    }
    return false
  }

  // ==================== Move Dialog State ====================

  /**
   * 移動對話框狀態
   */
  const isMoveDialogOpen = ref(false)
  const itemToMove = ref<MultiFunctionVerse | CustomFolder | null>(null)
  const itemToMoveType = ref<'verse' | 'folder' | null>(null)
  const moveDialogTargetFolderId = ref<string | null>(null) // 對話框中當前瀏覽的資料夾 ID (null 為 root)
  const moveDialogBreadcrumb = ref<string[]>([]) // 對話框中的麵包屑

  /**
   * 開啟移動對話框
   * @param item - 要移動的項目（經文或資料夾）
   * @param type - 項目類型
   */
  const openMoveDialog = (item: MultiFunctionVerse | CustomFolder, type: 'verse' | 'folder') => {
    itemToMove.value = item
    itemToMoveType.value = type
    moveDialogTargetFolderId.value = null // 每次打開都從 root 開始
    moveDialogBreadcrumb.value = []
    isMoveDialogOpen.value = true
  }

  /**
   * 關閉移動對話框
   */
  const closeMoveDialog = () => {
    isMoveDialogOpen.value = false
    itemToMove.value = null
    itemToMoveType.value = null
    moveDialogTargetFolderId.value = null
    moveDialogBreadcrumb.value = []
  }

  /**
   * 在移動對話框中導航到根目錄
   */
  const navigateMoveDialogToRoot = () => {
    moveDialogTargetFolderId.value = null
    moveDialogBreadcrumb.value = []
  }

  /**
   * 在移動對話框中導航到指定資料夾
   * @param folderId - 資料夾 ID
   */
  const navigateMoveDialogToFolder = (folderId: string) => {
    const folder = getFolderById(folderId)
    if (folder) {
      const index = moveDialogBreadcrumb.value.indexOf(folderId)
      const newPath =
        index !== -1 ? moveDialogBreadcrumb.value.slice(0, index + 1) : moveDialogBreadcrumb.value
      moveDialogBreadcrumb.value = newPath
      moveDialogTargetFolderId.value = folderId
    }
  }

  /**
   * 在移動對話框中選擇目標資料夾（進入該資料夾）
   * @param targetFolderId - 目標資料夾 ID
   */
  const selectMoveDialogTarget = (targetFolderId: string) => {
    const folder = getFolderById(targetFolderId)
    if (folder) {
      // 將資料夾添加到麵包屑中
      moveDialogBreadcrumb.value = [...moveDialogBreadcrumb.value, targetFolderId]
      moveDialogTargetFolderId.value = targetFolderId
    }
  }

  /**
   * 獲取移動對話框中應顯示的資料夾列表
   */
  const moveDialogFolders = computed(() => {
    if (moveDialogTargetFolderId.value) {
      // 如果在某個資料夾中，返回該資料夾的子資料夾
      const targetFolder = getFolderById(moveDialogTargetFolderId.value)
      return targetFolder ? targetFolder.folders : []
    } else {
      // 如果在根目錄（首頁），返回所有資料夾（除了 Homepage）
      return customFolders.value.filter((folder) => folder.id !== BIBLE_CONFIG.FOLDER.HOMEPAGE_ID)
    }
  })

  /**
   * 計算是否可以移動（是否選擇了目標）
   */
  const canMoveToTarget = computed(() => {
    if (!itemToMove.value || !itemToMoveType.value) return false

    // 情況1：經文在首頁，想移動到資料夾 - 需要選擇資料夾
    if (!currentFolder.value && itemToMoveType.value === 'verse') {
      return moveDialogTargetFolderId.value !== null
    }

    // 情況2：經文在資料夾，想移動到其他位置 - 總是允許移動
    // 情況3：移動資料夾 - 總是允許移動
    return true
  })

  /**
   * 確認移動
   */
  const confirmMove = () => {
    if (!itemToMove.value || !itemToMoveType.value || !canMoveToTarget.value) return

    const targetFolderId = moveDialogTargetFolderId.value

    if (itemToMoveType.value === 'verse') {
      moveVerseToFolder(itemToMove.value as MultiFunctionVerse, targetFolderId)
    } else if (itemToMoveType.value === 'folder') {
      if (targetFolderId) {
        // 防止將資料夾移動到自己內部
        const folderToMove = itemToMove.value as CustomFolder
        const targetFolder = getFolderById(targetFolderId)
        if (targetFolder && !isFolderInside(folderToMove, targetFolder)) {
          moveFolderToFolder(folderToMove, targetFolderId)
        }
      }
    }

    closeMoveDialog()
  }

  // ==================== Current Passage Actions ====================

  /**
   * Load passage
   * @param book - Bible book
   * @param chapter - chapter number
   * @param verse - verse number
   */
  const loadPassage = (book: BibleBook, chapter: number, verse: number) => {
    currentPassage.value = {
      bookAbbreviation: book.abbreviation || '',
      bookName: book.name,
      bookNumber: book.number,
      chapter,
      verse,
    }
  }

  // ==================== Watchers ====================

  // 監聽 customFolders 變化並自動保存
  watch(
    customFolders,
    () => {
      saveCustomFolders()
    },
    { deep: true },
  )

  // ==================== Initialization ====================

  /**
   * Initialize store (load from LocalStorage)
   */
  const initialize = () => {
    loadSelectedVersion()
    loadCustomFolders()
  }

  // Initialize on store creation
  initialize()

  return {
    // History
    historyVerses,
    addToHistory,
    clearHistory,
    // Bible Content Cache
    saveBibleContent,
    getBibleContent,
    hasCachedContent,
    // Selected Version
    selectedVersionId,
    loadSelectedVersion,
    setSelectedVersion,
    // Custom Folders
    customFolders,
    currentFolderPath,
    currentFolder,
    loadCustomFolders,
    saveCustomFolders,
    navigateToRoot,
    navigateToFolder,
    enterFolder,
    getFolderById,
    getCurrentFolders,
    getCurrentVerses,
    createFolder,
    deleteFolder,
    addVerseToFolder,
    removeVerseFromFolder,
    moveVerseToFolder,
    pasteItem,
    moveFolderToFolder,
    isFolderInside,
    // Current Passage
    currentPassage,
    loadPassage,
    // Move Dialog
    isMoveDialogOpen,
    itemToMove,
    moveDialogFolders,
    moveDialogBreadcrumb,
    moveDialogTargetFolderId,
    canMoveToTarget,
    openMoveDialog,
    closeMoveDialog,
    navigateMoveDialogToRoot,
    navigateMoveDialogToFolder,
    selectMoveDialogTarget,
    confirmMove,
    // Initialization
    initialize,
  }
})
