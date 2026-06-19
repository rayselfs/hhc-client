import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react/button'
import { Modal } from '@heroui/react/modal'
import { ArrowLeft, ChevronRight, Folder, Loader2 } from 'lucide-react'
import { listOneDriveFolders, type OneDriveRemoteFolder } from '@renderer/lib/onedrive-connect'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

interface FolderStackEntry {
  id: string
  name: string
}

export interface OneDriveFolderPickerDialogProps {
  isOpen: boolean
  isImporting?: boolean
  onClose: () => void
  onImport: (folder: OneDriveRemoteFolder) => void
}

export default function OneDriveFolderPickerDialog({
  isOpen,
  isImporting = false,
  onClose,
  onImport
}: OneDriveFolderPickerDialogProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const [folderStack, setFolderStack] = useState<FolderStackEntry[]>([
    { id: 'root', name: 'OneDrive' }
  ])
  const [folders, setFolders] = useState<OneDriveRemoteFolder[]>([])
  const [selectedFolder, setSelectedFolder] = useState<OneDriveRemoteFolder | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentFolder = folderStack[folderStack.length - 1]

  const loadFolders = useCallback(
    async (remoteFolderId: string): Promise<void> => {
      setIsLoading(true)
      setError(null)
      try {
        setFolders(await listOneDriveFolders(remoteFolderId))
      } catch (loadError) {
        console.warn('[onedrive] Failed to list folders', loadError)
        setFolders([])
        setError(t('fileExplorer.oneDriveFolderPicker.loadFailed'))
      } finally {
        setIsLoading(false)
      }
    },
    [t]
  )

  useEffect(() => {
    if (!isOpen) return
    setFolderStack([{ id: 'root', name: 'OneDrive' }])
    setSelectedFolder(null)
    void loadFolders('root')
  }, [isOpen, loadFolders])

  function openFolder(folder: OneDriveRemoteFolder): void {
    setFolderStack((current) => [...current, { id: folder.remoteItemId, name: folder.name }])
    setSelectedFolder(null)
    void loadFolders(folder.remoteItemId)
  }

  function goBack(): void {
    if (folderStack.length <= 1) return
    const nextStack = folderStack.slice(0, -1)
    setFolderStack(nextStack)
    setSelectedFolder(null)
    void loadFolders(nextStack[nextStack.length - 1].id)
  }

  if (!isOpen) return null

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onClose} isDismissable>
        <Modal.Container size="sm">
          <Modal.Dialog className="p-5">
            <Modal.Header>
              <Modal.Heading>{t('fileExplorer.oneDriveFolderPicker.title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <ShortcutScope name="overlay">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Button
                      size="sm"
                      variant="tertiary"
                      isDisabled={folderStack.length <= 1 || isLoading || isImporting}
                      onPress={goBack}
                      aria-label={t('fileExplorer.oneDriveFolderPicker.back')}
                    >
                      <ArrowLeft size={16} />
                    </Button>
                    <span className="truncate">{currentFolder.name}</span>
                  </div>

                  <div className="min-h-60 rounded-2xl bg-surface-secondary p-2">
                    {isLoading ? (
                      <div className="flex h-56 items-center justify-center text-muted">
                        <Loader2 size={20} className="animate-spin" />
                      </div>
                    ) : error ? (
                      <div className="flex h-56 items-center justify-center text-sm text-danger">
                        {error}
                      </div>
                    ) : folders.length === 0 ? (
                      <div className="flex h-56 items-center justify-center text-sm text-muted">
                        {t('fileExplorer.oneDriveFolderPicker.empty')}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {folders.map((folder) => {
                          const isSelected = selectedFolder?.remoteItemId === folder.remoteItemId
                          return (
                            <div
                              key={folder.remoteItemId}
                              className={[
                                'flex items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm',
                                isSelected
                                  ? 'bg-accent text-accent-foreground'
                                  : 'hover:bg-accent hover:text-accent-foreground'
                              ].join(' ')}
                            >
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                onClick={() => setSelectedFolder(folder)}
                              >
                                <Folder size={16} className="shrink-0" />
                                <span className="truncate">{folder.name}</span>
                              </button>
                              <button
                                type="button"
                                className="shrink-0 rounded-full p-1 hover:bg-black/10"
                                onClick={() => openFolder(folder)}
                                aria-label={t('fileExplorer.oneDriveFolderPicker.openFolder', {
                                  name: folder.name
                                })}
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </ShortcutScope>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" isDisabled={isImporting} onPress={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                isDisabled={!selectedFolder || isLoading || isImporting}
                onPress={() => {
                  if (selectedFolder) onImport(selectedFolder)
                }}
              >
                {isImporting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  t('fileExplorer.oneDriveFolderPicker.import')
                )}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
