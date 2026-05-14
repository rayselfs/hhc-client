import { useState } from 'react'
import { Plus, FolderPlus, Upload, Folder } from 'lucide-react'
import { Dropdown } from '@heroui/react/dropdown'
import { useTranslation } from 'react-i18next'
import { computeExpiresAt, type FolderDuration } from '@shared/types/folder'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { FolderModal } from '@renderer/components/Control/Folder/FolderModal'

export interface FileExplorerFABProps {
  onUploadFiles?: () => void
  onUploadFolder?: () => void
}

export default function FileExplorerFAB({
  onUploadFiles,
  onUploadFolder
}: FileExplorerFABProps): React.JSX.Element {
  const { t } = useTranslation()

  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)
  const addFolder = useFileExplorerStore((state) => state.addFolder)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderDuration, setFolderDuration] = useState<FolderDuration>('1day')

  function openCreateFolderModal(): void {
    const existingNames = getChildFolders(currentFolderId).map((f) => f.name)
    const base = t('folder.untitledFolder')
    let name = base
    let n = 2
    while (existingNames.includes(name)) {
      name = `${base} ${n}`
      n++
    }
    setFolderName(name)
    setFolderDuration('1day')
    setIsModalOpen(true)
  }

  function handleModalSubmit(): void {
    const name = folderName.trim()
    if (!name) return
    addFolder(name, currentFolderId, computeExpiresAt(folderDuration))
    setIsModalOpen(false)
  }

  return (
    <>
      <FolderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        editingFolder={null}
        folderName={folderName}
        onFolderNameChange={setFolderName}
        folderDuration={folderDuration}
        onFolderDurationChange={setFolderDuration}
      />
      <div className="fixed bottom-6 right-6 z-50">
        <Dropdown.Root>
          <Dropdown.Trigger>
            <div
              aria-label={t('fileExplorer.fab.label', 'New')}
              className="flex items-center justify-center w-14 h-14 rounded-full bg-surface text-foreground shadow-lg hover:opacity-80 transition-opacity cursor-default outline-none focus:outline-none"
            >
              <Plus size={24} />
            </div>
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'newFolder') openCreateFolderModal()
                if (key === 'uploadFiles') onUploadFiles?.()
                if (key === 'uploadFolder') onUploadFolder?.()
              }}
            >
              <Dropdown.Section>
                <Dropdown.Item
                  id="newFolder"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  <FolderPlus size={16} />
                  {t('fileExplorer.contextMenu.newFolder')}
                </Dropdown.Item>
              </Dropdown.Section>
              <Dropdown.Section>
                <Dropdown.Item
                  id="uploadFiles"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  <Upload size={16} />
                  {t('fileExplorer.contextMenu.uploadFiles')}
                </Dropdown.Item>
                <Dropdown.Item
                  id="uploadFolder"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  <Folder size={16} />
                  {t('fileExplorer.contextMenu.uploadFolder')}
                </Dropdown.Item>
              </Dropdown.Section>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>
    </>
  )
}
