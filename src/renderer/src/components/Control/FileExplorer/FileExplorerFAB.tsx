import { useEffect, useRef, useState } from 'react'
import { Plus, FolderPlus, Upload, Folder } from 'lucide-react'
import { Dropdown } from '@heroui/react/dropdown'
import { useTranslation } from 'react-i18next'
import { computeExpiresAt, type FolderDuration } from '@shared/types/folder'
import { addFileItemToStore, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { saveThumbnail } from '@renderer/lib/thumbnail-db'
import { FolderModal } from '@renderer/components/Control/Folder/FolderModal'

const SUPPORTED_EXTENSIONS = new Set(['pdf', 'pptx', 'ppt', 'key', 'odp'])

function isSupportedFile(file: File): boolean {
  const { type, name } = file
  if (type.startsWith('image/') || type.startsWith('video/')) return true
  if (type === 'application/pdf' || type.startsWith('application/vnd.')) return true
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_EXTENSIONS.has(ext)
}

function canGenerateThumbnail(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/pdf'
  )
}

async function uploadFiles(files: File[], parentId: string): Promise<void> {
  const ids = await Promise.all(files.map((f) => addFileItemToStore(f, parentId)))
  files.forEach((file, i) => {
    const itemId = ids[i]
    if (canGenerateThumbnail(file.type)) {
      void generateThumbnail(file).then(async (dataUrl) => {
        if (dataUrl) await saveThumbnail(itemId, dataUrl)
        window.dispatchEvent(
          new CustomEvent('hhc:thumbnail-ready', { detail: { itemId, dataUrl } })
        )
      })
    }
  })
}

export default function FileExplorerFAB(): React.JSX.Element {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const addFolder = useFileExplorerStore((state) => state.addFolder)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderDuration, setFolderDuration] = useState<FolderDuration>('permanent')

  useEffect(() => {
    const el = folderInputRef.current
    if (el) {
      el.setAttribute('webkitdirectory', '')
      el.setAttribute('directory', '')
    }
  }, [])

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
    setFolderDuration('permanent')
    setIsModalOpen(true)
  }

  function handleModalSubmit(): void {
    const name = folderName.trim()
    if (!name) return
    addFolder(name, currentFolderId, computeExpiresAt(folderDuration))
    setIsModalOpen(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    await uploadFiles(files, currentFolderId)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const allFiles = Array.from(e.target.files ?? []).filter(isSupportedFile)
    if (allFiles.length === 0) return

    const pathToFolderId = new Map<string, string>()

    for (const file of allFiles) {
      const parts = file.webkitRelativePath.split('/')
      for (let depth = 1; depth < parts.length; depth++) {
        const folderPath = parts.slice(0, depth).join('/')
        if (!pathToFolderId.has(folderPath)) {
          const parentPath = parts.slice(0, depth - 1).join('/')
          const parentId = depth === 1 ? currentFolderId : (pathToFolderId.get(parentPath) ?? currentFolderId)
          const id = addFolder(parts[depth - 1], parentId)
          pathToFolderId.set(folderPath, id)
        }
      }
    }

    const byParent = new Map<string, File[]>()
    for (const file of allFiles) {
      const parts = file.webkitRelativePath.split('/')
      const folderPath = parts.slice(0, parts.length - 1).join('/')
      const parentId = pathToFolderId.get(folderPath) ?? currentFolderId
      const group = byParent.get(parentId) ?? []
      group.push(file)
      byParent.set(parentId, group)
    }

    await Promise.all(
      Array.from(byParent.entries()).map(([parentId, files]) => uploadFiles(files, parentId))
    )

    if (folderInputRef.current) folderInputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.pptx,.ppt,.key,.odp"
        className="hidden"
        onChange={handleFileChange}
      />
      <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFolderChange} />
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
                if (key === 'newFolder') openCreateFolderModal()
                if (key === 'uploadFiles') fileInputRef.current?.click()
                if (key === 'uploadFolder') folderInputRef.current?.click()
              }}
            >
              <Dropdown.Item id="newFolder">
                <FolderPlus size={16} />
                {t('fileExplorer.fab.newFolder')}
              </Dropdown.Item>
              <Dropdown.Item id="uploadFiles">
                <Upload size={16} />
                {t('fileExplorer.fab.uploadFiles', 'Upload Files')}
              </Dropdown.Item>
              <Dropdown.Item id="uploadFolder">
                <Folder size={16} />
                {t('fileExplorer.fab.uploadFolder', 'Upload Folder')}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>
    </>
  )
}
