import { useEffect, useState } from 'react'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { BiblePreview } from '@renderer/components/Bible/BiblePreview'
import BibleMultiFunction from '@renderer/components/Bible/BibleMultiFunction'
import { BibleSelectorDialog } from '@renderer/components/Bible/BibleSelectorDialog'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { BiblePassage } from '@shared/types/bible'
import { toast } from '@heroui/react'

export default function BiblePage(): React.JSX.Element {
  const { isInitialized, initialize } = useBibleStore()
  const { isLoading, initialize: initializeFolderStore } = useBibleFolderStore()
  const [isSelectorOpen, setSelectorOpen] = useState(false)
  const { showMenu } = useContextMenu()

  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
    if (!isLoading) {
      initializeFolderStore()
    }
  }, [isInitialized, initialize, isLoading, initializeFolderStore])

  useEffect(() => {
    const handler = (): void => setSelectorOpen(true)
    window.addEventListener('open-bible-selector', handler)
    return () => window.removeEventListener('open-bible-selector', handler)
  }, [])

  const handleSelectPassage = (passage: BiblePassage): void => {
    useBibleStore.getState().navigateTo(passage)
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const verseNumber = event.currentTarget.dataset.verseNumber
    if (!verseNumber) return

    showMenu(
      [
        {
          id: 'copy',
          label: '複製經文',
          onAction: () => {
            // TODO: Implement copy
            toast.success('Copied')
          }
        },
        {
          id: 'add-to-folder',
          label: '添加到自訂資料夾',
          onAction: () => {
            // TODO: Implement add to folder
            toast.success('Added to folder')
          }
        }
      ],
      event
    )
  }

  return (
    <div data-testid="bible-page" className="flex flex-row gap-4 h-full p-4">
      <BiblePreview onContextMenu={handleContextMenu} />
      <BibleMultiFunction />
      <BibleSelectorDialog
        isOpen={isSelectorOpen}
        onOpenChange={setSelectorOpen}
        onSelect={handleSelectPassage}
      />
    </div>
  )
}
