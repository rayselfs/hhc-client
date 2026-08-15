import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import ProjectionRecoveryNotice from '@renderer/components/Control/ProjectionRecoveryNotice'
import type { ProjectionRecoveryState } from '@renderer/lib/projection-session-coordinator'

const projectionMock = vi.hoisted(() => ({
  recovery: {
    status: 'closed' as const,
    generation: 0,
    failure: null as {
      generation: number
      reason: 'renderer-crash' | 'popup-blocked' | 'ready-timeout'
    } | null
  } as ProjectionRecoveryState,
  vlcFailure: null as {
    itemId?: string
    code: 'runtime-missing' | 'binding-unavailable' | 'media-open-failed' | 'playback-failed'
    recoverable: boolean
    message: string
  } | null,
  retryProjection: vi.fn()
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => projectionMock
}))

describe('ProjectionRecoveryNotice', () => {
  beforeEach(async () => {
    projectionMock.recovery = {
      status: 'closed',
      generation: 0,
      failure: null
    }
    projectionMock.retryProjection.mockReset()
    projectionMock.vlcFailure = null
    projectionMock.retryProjection.mockResolvedValue({ ok: true, generation: 2 })
    await i18n.changeLanguage('en')
  })

  it.each(['closed', 'opening', 'ready'] as const)('does not render for the %s state', (status) => {
    projectionMock.recovery = {
      status,
      generation: status === 'closed' ? 0 : 1,
      failure: null
    }

    const { container } = render(<ProjectionRecoveryNotice />)

    expect(container).toBeEmptyDOMElement()
  })

  it('announces automatic recovery without offering a retry', () => {
    projectionMock.recovery = {
      status: 'recovering',
      generation: 2,
      failure: null
    }

    render(<ProjectionRecoveryNotice />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Restoring projection')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([
    ['popup-blocked', 'Projection popup was blocked'],
    ['ready-timeout', 'Projection did not become ready'],
    ['renderer-crash', 'Projection stopped unexpectedly']
  ] as const)('renders a retry action for %s', async (reason, title) => {
    const user = userEvent.setup()
    projectionMock.recovery = {
      status: 'failed',
      generation: 2,
      failure: { generation: 2, reason }
    }

    render(<ProjectionRecoveryNotice />)

    expect(screen.getByText(title)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry projection' }))
    expect(projectionMock.retryProjection).toHaveBeenCalledOnce()
  })

  it('renders the latest recoverable VLC failure with one retry action', async () => {
    const user = userEvent.setup()
    projectionMock.recovery = {
      status: 'ready',
      generation: 2,
      failure: null
    }
    projectionMock.vlcFailure = {
      itemId: 'item-1',
      code: 'playback-failed',
      recoverable: true,
      message: 'VLC playback stopped unexpectedly.'
    }

    render(<ProjectionRecoveryNotice />)

    expect(screen.getByText('VLC playback stopped unexpectedly.')).toBeInTheDocument()
    const retry = screen.getAllByRole('button', { name: 'Retry projection' })
    expect(retry).toHaveLength(1)
    await user.click(retry[0])
    expect(projectionMock.retryProjection).toHaveBeenCalledOnce()
  })
})
