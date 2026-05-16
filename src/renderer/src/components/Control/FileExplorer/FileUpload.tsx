import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { saveThumbnail } from '@renderer/lib/thumbnail-db'
import { generateThumbnail } from '@renderer/lib/thumbnail-generator'
import { addFileItemToStore } from '@renderer/stores/file-explorer'

interface FileUploadProps {
  currentFolderId: string
  onUploadStart?: () => void
  onUploadComplete?: (count: number) => void
}

function canGenerateThumbnail(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    file.type.startsWith('video/') ||
    file.type === 'application/pdf'
  )
}

async function generateAndSaveThumbnail(file: File, itemId: string): Promise<void> {
  const thumbnail = await generateThumbnail(file)
  if (thumbnail) await saveThumbnail(itemId, thumbnail)
}

export function FileUpload({
  currentFolderId,
  onUploadStart,
  onUploadComplete
}: FileUploadProps): React.JSX.Element {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleButtonClick(): void {
    inputRef.current?.click()
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    onUploadStart?.()

    await Promise.all(
      files.map(async (file) => {
        const itemId = await addFileItemToStore(file, currentFolderId)
        if (canGenerateThumbnail(file)) {
          generateAndSaveThumbnail(file, itemId).catch(console.error)
        }
      })
    )

    onUploadComplete?.(files.length)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.pptx,.ppt,.key,.odp"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={handleButtonClick}
        className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-default-600 hover:bg-default-100 transition-colors"
      >
        <Upload size={14} />
        {t('fileExplorer.upload.button')}
      </button>
    </>
  )
}
