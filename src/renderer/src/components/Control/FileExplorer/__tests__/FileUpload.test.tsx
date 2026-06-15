import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileUpload } from '../FileUpload'
import { uploadFiles } from '@renderer/lib/upload-utils'

vi.mock('@renderer/lib/upload-utils', () => ({
  uploadFiles: vi.fn()
}))

vi.mock('@renderer/lib/media-capabilities', () => ({
  getMediaFileAcceptAttribute: () => 'image/*,.pdf,.mkv'
}))

describe('FileUpload', () => {
  beforeEach(() => {
    vi.mocked(uploadFiles).mockReset()
    vi.mocked(uploadFiles).mockResolvedValue(1)
  })

  it('routes file input through the unified upload pipeline', async () => {
    const onUploadStart = vi.fn()
    const onUploadComplete = vi.fn()
    const file = new File([], 'slides.pdf', { type: '' })
    const { container } = render(
      <FileUpload
        currentFolderId="folder-1"
        onUploadStart={onUploadStart}
        onUploadComplete={onUploadComplete}
      />
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(uploadFiles).toHaveBeenCalledWith([file], 'folder-1'))
    expect(onUploadStart).toHaveBeenCalledOnce()
    expect(onUploadComplete).toHaveBeenCalledWith(1)
    expect(input.accept).toBe('image/*,.pdf,.mkv')
  })
})
