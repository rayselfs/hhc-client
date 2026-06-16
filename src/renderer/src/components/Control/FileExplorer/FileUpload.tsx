import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { getUploadMediaPlatform, uploadFiles } from '@renderer/lib/upload-utils'
import { getMediaFileAcceptAttribute } from '@renderer/lib/media-capabilities'

interface FileUploadProps {
  currentFolderId: string
  onUploadStart?: () => void
  onUploadComplete?: (count: number) => void
}

export function FileUpload({
  currentFolderId,
  onUploadStart,
  onUploadComplete
}: FileUploadProps): React.JSX.Element {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const fileAccept = getMediaFileAcceptAttribute(getUploadMediaPlatform())

  function handleButtonClick(): void {
    inputRef.current?.click()
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    onUploadStart?.()

    const uploadedCount = await uploadFiles(files, currentFolderId)
    onUploadComplete?.(uploadedCount)

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
        accept={fileAccept}
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
