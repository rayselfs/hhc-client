import { computed, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showSnackBar } from '@/composables/useSnackBar'
import { BibleFolder } from '@/types/enum'
import type { VerseItem, Folder } from '@/types/common'

interface UseBibleExportOptions {
  historyVerses: Ref<VerseItem[]>
  getCurrentFolders: ComputedRef<Folder<VerseItem>[]>
  getCurrentVerses: ComputedRef<VerseItem[]>
  currentFolder: ComputedRef<Folder<VerseItem>>
  customSelectedItems: Ref<Set<string>>
  multiFunctionTab: Ref<string>
  getFolderById: (id: string) => Folder<VerseItem> | null
}

interface ExportGroup {
  name: string
  verses: VerseItem[]
}

export function useBibleExport(options: UseBibleExportOptions) {
  const { t: $t } = useI18n()

  const {
    historyVerses,
    getCurrentFolders,
    getCurrentVerses,
    currentFolder,
    customSelectedItems,
    multiFunctionTab,
    getFolderById,
  } = options

  // Export Disable Logic
  const isExportDisabled = computed(() => {
    if (multiFunctionTab.value === 'history') {
      return historyVerses.value.length === 0
    } else {
      return customSelectedItems.value.size === 0 && getCurrentVerses.value.length === 0
    }
  })

  // Helper: Recursively collect verses from a folder
  const collectVersesFromFolder = async (folder: Folder<VerseItem>): Promise<VerseItem[]> => {
    let verses: VerseItem[] = [...(folder.items || [])]

    // If folder is not fully loaded, we might need to load it (if it was lazy loaded from sync/cloud)
    // For local folders, structure is already in memory.

    if (folder.folders && folder.folders.length > 0) {
      for (const subFolder of folder.folders) {
        const subVerses = await collectVersesFromFolder(subFolder)
        verses = [...verses, ...subVerses]
      }
    }
    return verses
  }

  // Helper: Generate Text
  const generateExportText = (groups: ExportGroup[]) => {
    return groups
      .map((group) => {
        const header = `[${group.name === BibleFolder.ROOT_NAME ? '首頁' : group.name}]`
        const content = group.verses
          .map((v) => ` - ${v.verseText} - ${v.bookAbbreviation} ${v.chapter}:${v.verse}`)
          .join('\n')
        return `${header}\n${content}`
      })
      .join('\n\n')
  }

  // Helper: Download File
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Export Logic
  const handleExport = async () => {
    const groups: ExportGroup[] = []

    if (multiFunctionTab.value === 'history') {
      if (historyVerses.value.length > 0) {
        groups.push({
          name: 'history',
          verses: historyVerses.value,
        })
      }
    } else {
      // Custom Tab
      if (customSelectedItems.value.size > 0) {
        // Export selected items (Folders + Verses)
        const selectedFolderIds: string[] = []
        const selectedVerseIds: string[] = []

        customSelectedItems.value.forEach((id) => {
          let folder = getFolderById(id) // Helper from store

          // Fallback: If store lookup fails, check current visible folders
          if (!folder) {
            const found = getCurrentFolders.value.find((f: Folder<VerseItem>) => f.id === id)
            if (found) folder = found
          }

          if (folder) {
            selectedFolderIds.push(id)
          } else {
            // Assume verse if not folder
            selectedVerseIds.push(id)
          }
        })

        // Handle Selected Folders
        for (const folderId of selectedFolderIds) {
          let folder = getFolderById(folderId)
          if (!folder) {
            const found = getCurrentFolders.value.find((f: Folder<VerseItem>) => f.id === folderId)
            if (found) folder = found
          }

          if (folder) {
            const folderVerses = await collectVersesFromFolder(folder)
            if (folderVerses.length > 0) {
              groups.push({
                name: folder.name,
                verses: folderVerses,
              })
            } else {
              showSnackBar($t('common.folderIsEmpty'), 'warning')
            }
          }
        }

        // Handle Selected Verses (that are in current view)
        // We filter getCurrentVerses to find the selected ones
        const selectedVersesInView = getCurrentVerses.value.filter((v: VerseItem) =>
          customSelectedItems.value.has(v.id),
        )
        if (selectedVersesInView.length > 0) {
          groups.push({
            name: currentFolder.value?.name || '首頁', // Use '首頁' for root
            verses: selectedVersesInView,
          })
        }
      } else {
        // Export Current Folder Content (No selection)
        if (getCurrentVerses.value.length > 0) {
          groups.push({
            name: currentFolder.value?.name || '首頁',
            verses: getCurrentVerses.value,
          })
        }
      }
    }

    if (groups.length === 0) return

    const textContent = generateExportText(groups)
    // Format: YYYYMMDD
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    // Determine filename based on selection
    let prefix = multiFunctionTab.value
    if (multiFunctionTab.value === 'custom') {
      if (customSelectedItems.value.size > 0) {
        prefix = 'custom-selected'
      } else {
        prefix = currentFolder.value?.name ? `custom-${currentFolder.value.name}` : 'custom-root'
      }
    }

    const filename = `bible-export-${prefix}-${timestamp}.txt`
    downloadFile(textContent, filename)
  }

  return {
    isExportDisabled,
    handleExport,
  }
}
