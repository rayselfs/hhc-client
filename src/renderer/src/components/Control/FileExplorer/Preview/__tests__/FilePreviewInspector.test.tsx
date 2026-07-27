import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PresentationReadinessReport } from '@renderer/lib/presentation-readiness'
import type { FileItemRecord } from '@shared/types/folder'
import { FilePreviewInspector, presentPreviewItem } from '../FilePreviewInspector'

function makeFile(overrides: Partial<FileItemRecord> = {}): FileItemRecord {
  return {
    id: 'image-1',
    parentId: 'root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'Photo.png',
    url: 'blob:image-1',
    size: 100,
    mimeType: 'image/png',
    ...overrides
  }
}

function makeReport(itemId: string, status: 'ready' | 'failed'): PresentationReadinessReport {
  return {
    summary: {
      ready: status === 'ready' ? 1 : 0,
      preparing: 0,
      unsupported: 0,
      missing: 0,
      failed: status === 'failed' ? 1 : 0
    },
    items: [
      {
        itemId,
        blobId: itemId,
        status,
        reason: status === 'ready' ? 'ready-native' : 'missing-source',
        support: status === 'ready' ? 'native' : null
      }
    ]
  }
}

describe('FilePreviewInspector', () => {
  it('keeps preview controls local until Present is pressed', async () => {
    const item = makeFile()
    const onPresent = vi.fn(async () => undefined)
    const onClose = vi.fn()

    render(
      <FilePreviewInspector
        item={item}
        thumbnailUrl={null}
        isPresenting={false}
        error={null}
        onClose={onClose}
        onPresent={onPresent}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(onPresent).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Present' }))
    await waitFor(() => expect(onPresent).toHaveBeenCalledOnce())
  })

  it('closes without presenting', () => {
    const onPresent = vi.fn(async () => undefined)
    const onClose = vi.fn()

    render(
      <FilePreviewInspector
        item={makeFile()}
        thumbnailUrl={null}
        isPresenting={false}
        error={null}
        onClose={onClose}
        onPresent={onPresent}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Close preview' })[0])

    expect(onClose).toHaveBeenCalledOnce()
    expect(onPresent).not.toHaveBeenCalled()
  })
})

describe('presentPreviewItem', () => {
  it('navigates to Media only when the requested item is ready', async () => {
    const item = makeFile()
    const start = vi.fn(async () => makeReport(item.id, 'ready'))
    const navigate = vi.fn()

    const error = await presentPreviewItem({
      item,
      playlist: [item],
      start,
      navigate
    })

    expect(start).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('/media')
    expect(error).toBeNull()
  })

  it('keeps the preview open and returns the readiness reason when Present fails', async () => {
    const item = makeFile()
    const start = vi.fn(async () => makeReport(item.id, 'failed'))
    const navigate = vi.fn()

    const error = await presentPreviewItem({
      item,
      playlist: [item],
      start,
      navigate
    })

    expect(start).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
    expect(error).toBe('missing-source')
  })
})
