import { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from '@heroui/react'
import { FileQuestion, Minus, Plus, Presentation, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useThumbnails } from '@renderer/hooks/useThumbnails'
import { getMediaType } from '@renderer/lib/presentability'
import { presentPreviewItem, startMediaProjection } from '@renderer/lib/projection-actions'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { isFileItem, type FileItemRecord } from '@shared/types/folder'

interface FilePreviewInspectorProps {
  item: FileItemRecord
  thumbnailUrl: string | null
  isPresenting: boolean
  error: string | null
  onClose: () => void
  onPresent: () => Promise<void>
}

function PreviewSurface({
  item,
  thumbnailUrl,
  zoom
}: Pick<FilePreviewInspectorProps, 'item' | 'thumbnailUrl'> & {
  zoom: number
}): React.JSX.Element {
  const mediaType = getMediaType(item.mimeType)
  const transform = { transform: `scale(${zoom})` }

  if (mediaType === 'image') {
    return (
      <img
        src={item.url}
        alt={item.name}
        className="max-h-full max-w-full object-contain transition-transform"
        style={transform}
      />
    )
  }

  if (mediaType === 'video') {
    return (
      <video
        src={item.url}
        controls
        preload="metadata"
        className="max-h-full max-w-full"
        aria-label={item.name}
      />
    )
  }

  if (mediaType === 'pdf') {
    return (
      <iframe
        src={item.url}
        title={item.name}
        className="h-full w-full rounded-lg border-0 bg-white transition-transform"
        style={transform}
      />
    )
  }

  if (mediaType === 'presentation') {
    return thumbnailUrl ? (
      <img
        src={thumbnailUrl}
        alt={item.name}
        className="max-h-full max-w-full object-contain transition-transform"
        style={transform}
      />
    ) : (
      <div className="flex flex-col items-center gap-3 text-muted">
        <Presentation className="size-16" aria-hidden="true" />
        <span>{item.name}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 text-muted">
      <FileQuestion className="size-16" aria-hidden="true" />
      <span>{item.name}</span>
    </div>
  )
}

export function FilePreviewInspector({
  item,
  thumbnailUrl,
  isPresenting,
  error,
  onClose,
  onPresent
}: FilePreviewInspectorProps): React.JSX.Element {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isPresenting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresenting, onClose])

  return (
    <Modal>
      <Modal.Backdrop isOpen isDismissable={false} isKeyboardDismissDisabled>
        <Modal.Container size="cover">
          <Modal.Dialog className="h-[calc(100vh-5rem)]">
            <Button
              isIconOnly
              variant="ghost"
              className="absolute right-4 top-4 z-10"
              aria-label={t('mediaPreview.close', 'Close preview')}
              onPress={onClose}
            >
              <X className="size-4" />
            </Button>
            <Modal.Header>
              <Modal.Heading>{item.name}</Modal.Heading>
              <p className="text-sm text-muted">{item.mimeType}</p>
            </Modal.Header>
            <Modal.Body className="min-h-0">
              <div className="flex h-full min-h-80 items-center justify-center overflow-auto rounded-xl bg-black/90 p-6">
                <PreviewSurface item={item} thumbnailUrl={thumbnailUrl} zoom={zoom} />
              </div>
              {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {t(`mediaPreview.errors.${error}`, error)}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer className="justify-between">
              <div className="flex items-center gap-2">
                <Button
                  isIconOnly
                  variant="tertiary"
                  aria-label={t('mediaPreview.zoomOut', 'Zoom out')}
                  onPress={() => setZoom((value) => Math.max(0.5, value - 0.1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-12 text-center text-sm tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  isIconOnly
                  variant="tertiary"
                  aria-label={t('mediaPreview.zoomIn', 'Zoom in')}
                  onPress={() => setZoom((value) => Math.min(2, value + 0.1))}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="tertiary"
                  aria-label={t('mediaPreview.close', 'Close preview')}
                  onPress={onClose}
                >
                  {t('common.close', 'Close')}
                </Button>
                <Button
                  variant="primary"
                  isDisabled={isPresenting}
                  data-testid="preview-present"
                  onPress={() => void onPresent()}
                >
                  {isPresenting
                    ? t('mediaPreview.preparing', 'Preparing…')
                    : t('mediaPreview.present', 'Present')}
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default function FilePreviewRoute(): React.JSX.Element | null {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const items = useFileExplorerStore((state) => state.items)
  const [isPresenting, setIsPresenting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const item = itemId && isFileItem(items[itemId]) ? items[itemId] : null
  const thumbnails = useThumbnails(item ? [item] : [])

  const playlist = useMemo(() => {
    if (!item) return []
    return Object.values(items)
      .filter(
        (entry): entry is FileItemRecord =>
          isFileItem(entry) &&
          entry.parentId === item.parentId &&
          getMediaType(entry.mimeType) !== null &&
          !entry.url.startsWith('unsupported:')
      )
      .sort((a, b) => a.sortIndex - b.sortIndex || a.createdAt - b.createdAt)
  }, [item, items])

  if (!item) return null

  const close = (): void => {
    void navigate('/files')
  }
  const present = async (): Promise<void> => {
    setIsPresenting(true)
    setError(null)
    try {
      setError(
        await presentPreviewItem({
          item,
          playlist,
          start: startMediaProjection,
          navigate: (path) => {
            void navigate(path, { flushSync: true })
          }
        })
      )
    } finally {
      setIsPresenting(false)
    }
  }

  return (
    <FilePreviewInspector
      item={item}
      thumbnailUrl={thumbnails[item.id] ?? null}
      isPresenting={isPresenting}
      error={error}
      onClose={close}
      onPresent={present}
    />
  )
}
