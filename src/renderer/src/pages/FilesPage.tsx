import { FileExplorerShell } from '@renderer/components/Control/FileExplorer'
import FileBrowser from '@renderer/components/Control/FileExplorer/FileBrowser'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'

export default function FilesPage(): React.JSX.Element {
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const getItems = useFileExplorerStore((state) => state.getItems)

  const itemCount = getItems(currentFolderId).length

  return (
    <FileExplorerShell itemCount={itemCount} selectedCount={0}>
      <FileBrowser />
    </FileExplorerShell>
  )
}
