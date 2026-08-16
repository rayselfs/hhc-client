import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@renderer/i18n'
import CloudFolderPickerDialog, { type CloudFolderPickerProvider } from '../CloudFolderPickerDialog'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import type { CloudRemoteFolder } from '@renderer/lib/cloud-provider'

const listFolders = vi.fn(async () => [
  { remoteItemId: 'collection-1', name: 'Sunday', parentRemoteItemId: null },
  { remoteItemId: 'collection-2', name: 'Youth', parentRemoteItemId: null }
])

const provider: CloudFolderPickerProvider = {
  providerType: 'hhc-line',
  displayName: 'HHC LINE',
  icon: null,
  supportsFolderNavigation: false,
  listFolders,
  importFolder: vi.fn()
}

function dialog(isOpen: boolean, onImport = vi.fn()): React.JSX.Element {
  return (
    <ShortcutScopeProvider>
      <CloudFolderPickerDialog
        provider={provider}
        isOpen={isOpen}
        onClose={() => undefined}
        onImport={onImport}
      />
    </ShortcutScopeProvider>
  )
}

describe('HHC LINE folder picker', () => {
  beforeEach(() => listFolders.mockClear())

  it('keeps authorized collections as a flat single-selection list', async () => {
    const user = userEvent.setup()
    const onImport = vi.fn()
    render(dialog(true, onImport))

    const sunday = await screen.findByRole('button', { name: 'Sunday' })
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    await user.dblClick(sunday)
    expect(listFolders).toHaveBeenCalledTimes(1)

    await user.click(await screen.findByRole('button', { name: 'Youth' }))
    await user.click(screen.getByRole('button', { name: 'Add Folder' }))
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ remoteItemId: 'collection-2' }))
  })

  it('reloads the top-level collection list whenever the same dialog is reopened', async () => {
    const view = render(dialog(true))
    await screen.findByRole('button', { name: 'Sunday' })
    view.rerender(dialog(false))
    view.rerender(dialog(true))

    await waitFor(() => expect(listFolders).toHaveBeenCalledTimes(2))
  })

  it('ignores an old account list that resolves after a new picker load', async () => {
    let resolveOld!: (folders: Awaited<ReturnType<typeof listFolders>>) => void
    const oldProvider: CloudFolderPickerProvider = {
      ...provider,
      listFolders: vi.fn(
        () =>
          new Promise<CloudRemoteFolder[]>((resolve) => {
            resolveOld = resolve
          })
      )
    }
    const newProvider: CloudFolderPickerProvider = {
      ...provider,
      listFolders: vi.fn(async () => [
        { remoteItemId: 'collection-new', name: 'New account', parentRemoteItemId: null }
      ])
    }
    const view = render(
      <ShortcutScopeProvider>
        <CloudFolderPickerDialog
          provider={oldProvider}
          isOpen
          onClose={() => undefined}
          onImport={() => undefined}
        />
      </ShortcutScopeProvider>
    )
    view.rerender(
      <ShortcutScopeProvider>
        <CloudFolderPickerDialog
          provider={newProvider}
          isOpen
          onClose={() => undefined}
          onImport={() => undefined}
        />
      </ShortcutScopeProvider>
    )
    await screen.findByRole('button', { name: 'New account' })

    await act(async () => {
      resolveOld([
        { remoteItemId: 'collection-old', name: 'Old account', parentRemoteItemId: null }
      ])
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Old account' })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'New account' })).toBeInTheDocument()
  })
})
