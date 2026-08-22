import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '@renderer/i18n'
import { FolderPersistenceStatus } from '../FolderPersistenceStatus'

const baseProps = {
  error: null,
  isInitialized: true,
  onRetryInitialization: vi.fn().mockResolvedValue(undefined),
  onRetryPersistence: vi.fn().mockResolvedValue(undefined)
}

describe('FolderPersistenceStatus', () => {
  it('does not render when persistence is ready', () => {
    const { container } = render(<FolderPersistenceStatus {...baseProps} status="ready" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('reports unsaved writes and retries the persistence queue', async () => {
    const user = userEvent.setup()
    const retryPersistence = vi.fn().mockResolvedValue(undefined)
    render(
      <FolderPersistenceStatus
        {...baseProps}
        status="degraded"
        error="quota exceeded"
        onRetryPersistence={retryPersistence}
      />
    )

    expect(screen.getByText('Local changes were not saved')).toBeInTheDocument()
    expect(screen.getByText('quota exceeded')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retryPersistence).toHaveBeenCalledOnce()
  })

  it('retries initialization after a library load failure', async () => {
    const user = userEvent.setup()
    const retryInitialization = vi.fn().mockResolvedValue(undefined)
    render(
      <FolderPersistenceStatus
        {...baseProps}
        status="degraded"
        error="indexeddb unavailable"
        isInitialized={false}
        onRetryInitialization={retryInitialization}
      />
    )

    expect(screen.getByText('Local library is unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retryInitialization).toHaveBeenCalledOnce()
  })

  it('does not render a transient saving banner', () => {
    const { container } = render(<FolderPersistenceStatus {...baseProps} status="saving" />)

    expect(container).toBeEmptyDOMElement()
  })
})
