import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HhcSession } from '@shared/hhc-auth'

const mocks = vi.hoisted(() => ({
  session: null as HhcSession | null,
  getAccessToken: vi.fn<() => Promise<string | null>>(),
  refreshAccessToken: vi.fn<() => Promise<string | null>>(),
  getCloudProviderAdapter: vi.fn((providerId: string) => ({
    id: providerId,
    supportsFolderNavigation: providerId === 'hhc-line' ? false : undefined,
    getConnectedAccount: vi.fn(async () => null),
    listFolders: vi.fn(async () => []),
    importFolder: vi.fn(),
    refreshFolder: vi.fn()
  })),
  fileState: {
    currentFolderId: 'file-root',
    folders: {},
    items: {},
    _itemsByParent: {},
    _childFoldersByParent: {},
    persistenceStatus: 'ready',
    persistenceError: null,
    pendingPersistenceCount: 0,
    isInitialized: true,
    getChildFolders: vi.fn(() => []),
    getItems: vi.fn(() => []),
    addFolder: vi.fn(),
    moveItem: vi.fn(),
    copyItem: vi.fn(),
    moveFolder: vi.fn(),
    updateFolder: vi.fn(),
    retryInitialization: vi.fn(),
    retryPersistence: vi.fn()
  }
}))

vi.mock('@renderer/contexts/HhcAuthContext', () => ({
  useHhcAuth: () => ({
    status: mocks.session ? 'authenticated' : 'anonymous',
    session: mocks.session,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: mocks.getAccessToken,
    refreshAccessToken: mocks.refreshAccessToken
  })
}))

vi.mock('react-router-dom', () => ({
  Outlet: () => null,
  useNavigate: () => vi.fn()
}))

vi.mock('@renderer/stores/file-explorer', () => ({
  FILE_EXPLORER_ROOT_ID: 'file-root',
  useFileExplorerStore: Object.assign(
    (selector: (state: typeof mocks.fileState) => unknown) => selector(mocks.fileState),
    { getState: () => mocks.fileState }
  ),
  deleteFolderFromStore: vi.fn(),
  removeFileItemFromStore: vi.fn()
}))

vi.mock('@renderer/components/Control/FileExplorer', () => ({
  FileExplorerShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useFileContextMenu: () => ({
    showItemMenu: vi.fn(),
    showFolderMenu: vi.fn(),
    showMultiSelectMenu: vi.fn(),
    showEmptyAreaMenu: vi.fn()
  })
}))

vi.mock('@renderer/components/Control/FileExplorer/FileBrowser', () => ({ default: () => null }))
vi.mock('@renderer/components/Control/FileExplorer/FileExplorerFAB', () => ({
  default: ({ onAddHhcLine }: { onAddHhcLine?: () => void }) =>
    onAddHhcLine ? <button onClick={onAddHhcLine}>Add HHC LINE</button> : null
}))
vi.mock('@renderer/components/Control/FileExplorer/CloudFolderPickerDialog', () => ({
  default: ({ provider, isOpen }: { provider: { providerType: string }; isOpen: boolean }) =>
    provider.providerType === 'hhc-line' && isOpen ? <div>HHC picker open</div> : null
}))
vi.mock('@renderer/components/Control/Folder/FolderModal', () => ({ FolderModal: () => null }))
vi.mock('@renderer/components/Common/FolderPersistenceStatus', () => ({
  FolderPersistenceStatus: () => null
}))
vi.mock('@renderer/contexts/ConfirmDialogContext', () => ({ useConfirm: () => vi.fn() }))
vi.mock('@renderer/stores/soundboard', () => ({
  useSoundboardStore: { getState: () => ({ findPadsUsingAsset: () => [] }) }
}))
vi.mock('@renderer/lib/cloud-provider', () => ({
  getCloudProviderAdapter: mocks.getCloudProviderAdapter
}))
vi.mock('@renderer/lib/editable-presentation', () => ({ createEditablePresentation: vi.fn() }))
vi.mock('@renderer/lib/local-sync-import', () => ({
  connectLocalSyncFolder: vi.fn(),
  refreshLocalSyncConnection: vi.fn()
}))
vi.mock('@renderer/lib/upload-utils', () => ({
  getUploadMediaPlatform: () => 'web',
  uploadFiles: vi.fn(),
  uploadFolderFiles: vi.fn()
}))
vi.mock('@renderer/lib/presentation-item-actions', () => ({
  buildPresentationItemActions: () => []
}))
vi.mock('@renderer/stores/presentation-workspace', () => ({
  usePresentationWorkspaceStore: { getState: () => ({ openDocument: vi.fn() }) }
}))

import FilesPage from '../FilesPage'

describe('FilesPage HHC LINE role resolution', () => {
  beforeEach(() => {
    mocks.session = {
      userId: 'user-1',
      displayName: 'Ada',
      roles: ['media_sync_user']
    }
    mocks.getAccessToken.mockReset()
    mocks.refreshAccessToken.mockReset()
    mocks.getCloudProviderAdapter.mockReset()
    mocks.getCloudProviderAdapter.mockImplementation((providerId: string) => ({
      id: providerId,
      supportsFolderNavigation: providerId === 'hhc-line' ? false : undefined,
      getConnectedAccount: vi.fn(async () => null),
      listFolders: vi.fn(async () => []),
      importFolder: vi.fn(),
      refreshFolder: vi.fn()
    }))
  })

  it('shows the action only after one claims refresh for the current user', async () => {
    let resolveToken!: (token: string | null) => void
    mocks.getAccessToken.mockReturnValue(
      new Promise((resolve) => {
        resolveToken = resolve
      })
    )
    const view = render(<FilesPage />)

    expect(screen.queryByRole('button', { name: 'Add HHC LINE' })).not.toBeInTheDocument()
    expect(mocks.getAccessToken).toHaveBeenCalledTimes(1)

    await act(async () => resolveToken('token'))
    expect(await screen.findByRole('button', { name: 'Add HHC LINE' })).toBeInTheDocument()
    view.rerender(<FilesPage />)
    expect(mocks.getAccessToken).toHaveBeenCalledTimes(1)
    expect(mocks.getCloudProviderAdapter).toHaveBeenCalledWith(
      'hhc-line',
      expect.objectContaining({
        getAccessToken: mocks.getAccessToken,
        refreshAccessToken: mocks.refreshAccessToken
      })
    )
  })

  it('hides and resolves again when the account changes', async () => {
    mocks.getAccessToken.mockResolvedValue('token')
    const view = render(<FilesPage />)
    await screen.findByRole('button', { name: 'Add HHC LINE' })

    mocks.session = {
      userId: 'user-2',
      displayName: 'Grace',
      roles: ['reader']
    }
    view.rerender(<FilesPage />)

    await waitFor(() => expect(mocks.getAccessToken).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('button', { name: 'Add HHC LINE' })).not.toBeInTheDocument()
  })

  it('closes an open HHC picker as soon as the current account loses eligibility', async () => {
    mocks.getAccessToken.mockResolvedValue('token')
    const view = render(<FilesPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add HHC LINE' }))
    expect(screen.getByText('HHC picker open')).toBeInTheDocument()

    mocks.session = {
      userId: 'user-2',
      displayName: 'Grace',
      roles: ['reader']
    }
    view.rerender(<FilesPage />)

    await waitFor(() => expect(screen.queryByText('HHC picker open')).not.toBeInTheDocument())
  })
})
