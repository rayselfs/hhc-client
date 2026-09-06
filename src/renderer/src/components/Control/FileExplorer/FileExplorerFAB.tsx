import { Separator } from '@heroui/react/separator'
import { useState } from 'react'
import { Plus, FolderPlus, Upload, Folder, Presentation } from 'lucide-react'
import { Dropdown } from '@renderer/components/Common/MenuPopover'
import { useTranslation } from 'react-i18next'
import { computeExpiresAt, type FolderDuration } from '@shared/types/folder'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { FolderModal } from '@renderer/components/Control/Folder/FolderModal'
import { SyncProviderIcon } from '@renderer/components/icons/SyncProviderIcon'

export interface FileExplorerFABProps {
  onUploadFiles?: () => void
  onUploadFolder?: () => void
  onCreatePresentation?: () => void
  onAddLocalSyncFolder?: () => void
  onAddOneDrive?: () => void
  onAddHhcLine?: () => void
  isAddOneDriveDisabled?: boolean
  isAddHhcLineDisabled?: boolean
  isReadOnly?: boolean
}

export default function FileExplorerFAB({
  onUploadFiles,
  onUploadFolder,
  onCreatePresentation,
  onAddLocalSyncFolder,
  onAddOneDrive,
  onAddHhcLine,
  isAddOneDriveDisabled = false,
  isAddHhcLineDisabled = false,
  isReadOnly = false
}: FileExplorerFABProps): React.JSX.Element | null {
  const { t } = useTranslation()

  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)
  const addFolder = useFileExplorerStore((state) => state.addFolder)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderDuration, setFolderDuration] = useState<FolderDuration>('1day')

  function openCreateFolderModal(): void {
    if (isReadOnly) return
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
    if (isReadOnly) return
    const name = folderName.trim()
    if (!name) return
    addFolder(name, currentFolderId, computeExpiresAt(folderDuration))
    setIsModalOpen(false)
  }

  const hasWritableActions = !isReadOnly
  const hasSourceActions = Boolean(onAddLocalSyncFolder || onAddOneDrive || onAddHhcLine)

  if (!hasWritableActions && !hasSourceActions) return null

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
              className="flex items-center justify-center w-14 h-14 rounded-full bg-surface text-foreground shadow-lg hover:opacity-80 transition-opacity cursor-default"
            >
              <Plus size={24} />
            </div>
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'newFolder' && !isReadOnly) openCreateFolderModal()
                if (key === 'createPresentation' && !isReadOnly) onCreatePresentation?.()
                if (key === 'uploadFiles' && !isReadOnly) onUploadFiles?.()
                if (key === 'uploadFolder' && !isReadOnly) onUploadFolder?.()
                if (key === 'addLocalSyncFolder') onAddLocalSyncFolder?.()
                if (key === 'addOneDrive' && !isAddOneDriveDisabled) onAddOneDrive?.()
                if (key === 'addHhcLine' && !isAddHhcLineDisabled) onAddHhcLine?.()
              }}
            >
              {!isReadOnly && (
                <Dropdown.Section>
                  <Dropdown.Item
                    id="newFolder"
                    className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                  >
                    <FolderPlus size={16} />
                    {t('fileExplorer.contextMenu.newFolder')}
                  </Dropdown.Item>
                </Dropdown.Section>
              )}
              {!isReadOnly && <Separator />}
              {!isReadOnly && (
                <Dropdown.Section>
                  <Dropdown.Item
                    id="createPresentation"
                    className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                  >
                    <Presentation size={16} />
                    {t('fileExplorer.contextMenu.createPresentation')}
                  </Dropdown.Item>
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
              )}
              {!isReadOnly && hasSourceActions && <Separator />}
              {hasSourceActions && (
                <Dropdown.Section>
                  {onAddLocalSyncFolder && (
                    <Dropdown.Item
                      id="addLocalSyncFolder"
                      className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                    >
                      <SyncProviderIcon providerType="local-fs" className="size-4" />
                      {t('fileExplorer.contextMenu.addLocalSyncFolder')}
                    </Dropdown.Item>
                  )}
                  {onAddOneDrive && (
                    <Dropdown.Item
                      id="addOneDrive"
                      isDisabled={isAddOneDriveDisabled}
                      className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                    >
                      <SyncProviderIcon providerType="onedrive" className="size-4" />
                      {t('fileExplorer.contextMenu.addOneDrive')}
                    </Dropdown.Item>
                  )}
                  {onAddHhcLine && (
                    <Dropdown.Item
                      id="addHhcLine"
                      isDisabled={isAddHhcLineDisabled}
                      className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                    >
                      <span aria-hidden="true" className="size-4 shrink-0">
                        <SyncProviderIcon providerType="hhc-line" className="size-4" />
                      </span>
                      {t('fileExplorer.contextMenu.addHhcLine')}
                    </Dropdown.Item>
                  )}
                </Dropdown.Section>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>
    </>
  )
}
