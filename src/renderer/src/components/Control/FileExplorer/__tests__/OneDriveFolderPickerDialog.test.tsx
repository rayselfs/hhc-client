import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@renderer/i18n'
import OneDriveFolderPickerDialog from '../OneDriveFolderPickerDialog'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

const mockListFolders = vi.hoisted(() => vi.fn())

vi.mock('@renderer/lib/cloud-provider', () => ({
  getCloudProviderAdapter: () => ({
    listFolders: mockListFolders
  })
}))

function renderDialog(): ReturnType<typeof render> {
  return render(
    <ShortcutScopeProvider>
      <OneDriveFolderPickerDialog isOpen onClose={() => undefined} onImport={() => undefined} />
    </ShortcutScopeProvider>
  )
}

describe('OneDriveFolderPickerDialog', () => {
  beforeEach(() => {
    mockListFolders.mockReset()
    mockListFolders.mockImplementation(async (folderId: string) =>
      folderId === 'root'
        ? [{ remoteItemId: 'folder-1', name: 'Drama', parentRemoteItemId: null }]
        : [{ remoteItemId: 'folder-2', name: 'Music', parentRemoteItemId: 'folder-1' }]
    )
  })

  it('opens folders with double click and does not render a separate arrow button', async () => {
    const user = userEvent.setup()
    renderDialog()

    const folder = await screen.findByRole('button', { name: 'Drama' })
    expect(
      screen.queryByRole('button', {
        name: 'Open Drama'
      })
    ).not.toBeInTheDocument()

    await user.dblClick(folder)

    await waitFor(() => {
      expect(mockListFolders).toHaveBeenLastCalledWith('folder-1')
    })
    expect(await screen.findByRole('button', { name: 'Music' })).toBeInTheDocument()
  })
})
