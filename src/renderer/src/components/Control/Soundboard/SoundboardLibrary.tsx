import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@heroui/react/button'
import { getAudioFileAcceptAttribute, isAudioMediaItem } from '@renderer/lib/media-capabilities'
import { getUploadMediaPlatform, uploadFilesForKind } from '@renderer/lib/upload-utils'
import { FILE_EXPLORER_ROOT_ID, useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useSoundboardStore } from '@renderer/stores/soundboard'
import type { FileItemRecord } from '@shared/types/folder'

export default function SoundboardLibrary(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const items = useFileExplorerStore((state) => state.items)
  const assignPadAsset = useSoundboardStore((state) => state.assignPadAsset)
  const selectedPadId = useSoundboardStore((state) => state.selectedPadId)
  const [query, setQuery] = useState('')

  useEffect(() => {
    void useFileExplorerStore.getState().ensureItemsLoaded(FILE_EXPLORER_ROOT_ID)
  }, [])

  const audioItems = useMemo(
    () =>
      Object.values(items)
        .filter((item): item is FileItemRecord => item.type === 'file' && isAudioMediaItem(item))
        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  )

  async function handleUpload(files: FileList | null): Promise<void> {
    const selected = Array.from(files ?? [])
    if (selected.length === 0) return
    await uploadFilesForKind(selected, FILE_EXPLORER_ROOT_ID, 'audio')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-secondary">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <input
          aria-label="Search audio"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <Button isIconOnly size="sm" variant="ghost" onPress={() => inputRef.current?.click()}>
          <Upload className="size-4" />
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={getAudioFileAcceptAttribute(getUploadMediaPlatform())}
          className="hidden"
          onChange={(event) => void handleUpload(event.currentTarget.files)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {audioItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/15"
            onClick={() => {
              if (!selectedPadId) return
              assignPadAsset(selectedPadId, {
                assetId: item.id,
                name: item.name,
                mimeType: item.mimeType,
                size: item.size
              })
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
    </aside>
  )
}
