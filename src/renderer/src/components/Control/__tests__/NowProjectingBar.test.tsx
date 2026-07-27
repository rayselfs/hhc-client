import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@renderer/i18n'
import i18n from '@renderer/i18n'
import NowProjectingBar from '../NowProjectingBar'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

const mocks = vi.hoisted(() => {
  const actions = {
    retryProjection: vi.fn(),
    blackoutProjection: vi.fn(),
    closeProjection: vi.fn(),
    bringProjectionToFront: vi.fn()
  }
  return {
    actions,
    value: {
      isProjectionOpen: true,
      recovery: {
        status: 'ready',
        generation: 1,
        failure: null as null | { generation: number; reason: string; timestamp: number }
      },
      sessionSummary: {
        owner: 'media' as string | null,
        status: 'projecting',
        label: 'Photo.png' as string | null,
        isBlackout: false,
        failure: null as null | { generation: number; reason: string; timestamp: number }
      },
      getProjectionSnapshot: vi.fn<() => { owner: string } | null>(() => ({ owner: 'media' })),
      ...actions
    }
  }
})

vi.mock('@renderer/contexts/ProjectionContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/contexts/ProjectionContext')>()
  return {
    ...actual,
    useProjection: () => mocks.value
  }
})

function renderBar(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <NowProjectingBar />
    </MemoryRouter>
  )
}

describe('NowProjectingBar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.clearAllMocks()
    Object.assign(mocks.value, {
      isProjectionOpen: true,
      recovery: { status: 'ready', generation: 1, failure: null },
      sessionSummary: {
        owner: 'media',
        status: 'projecting',
        label: 'Photo.png',
        isBlackout: false,
        failure: null
      }
    })
    mocks.value.getProjectionSnapshot.mockReturnValue({ owner: 'media' })
    useMediaProjectionStore.setState({ lastReadinessReport: null })
  })

  it('is hidden only when the derived session status is closed', () => {
    mocks.value.isProjectionOpen = false
    mocks.value.recovery = { status: 'closed', generation: 0, failure: null }
    mocks.value.sessionSummary = {
      owner: null,
      status: 'closed',
      label: null,
      isBlackout: false,
      failure: null
    }
    mocks.value.getProjectionSnapshot.mockReturnValue(null)

    const { container } = renderBar()

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the localized owner, content, and projecting status', () => {
    renderBar()

    expect(screen.getByRole('status')).toHaveTextContent('Projecting')
    expect(screen.getByRole('status')).toHaveTextContent('Media')
    expect(screen.getByRole('status')).toHaveTextContent('Photo.png')
    expect(screen.getByRole('button', { name: 'Return to Media Workspace' })).toBeInTheDocument()
  })

  it('stops visible content without foregrounding the projection', () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Stop Content' }))

    expect(mocks.actions.blackoutProjection).toHaveBeenCalledWith(true)
    expect(mocks.actions.bringProjectionToFront).not.toHaveBeenCalled()
  })

  it('resumes blackout content without foregrounding the projection', () => {
    mocks.value.sessionSummary = {
      ...mocks.value.sessionSummary,
      status: 'connected',
      isBlackout: true
    }
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Resume Content' }))

    expect(mocks.actions.blackoutProjection).toHaveBeenCalledWith(false)
    expect(mocks.actions.bringProjectionToFront).not.toHaveBeenCalled()
  })

  it('exposes retry for failure and keeps actions independent', () => {
    mocks.value.recovery = {
      status: 'failed',
      generation: 1,
      failure: { generation: 1, reason: 'readiness-timeout', timestamp: 1 }
    }
    mocks.value.sessionSummary = {
      ...mocks.value.sessionSummary,
      status: 'failed',
      failure: mocks.value.recovery.failure
    }
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.actions.retryProjection).toHaveBeenCalledOnce()
    expect(mocks.actions.blackoutProjection).not.toHaveBeenCalled()
    expect(mocks.actions.closeProjection).not.toHaveBeenCalled()
    expect(mocks.actions.bringProjectionToFront).not.toHaveBeenCalled()
  })

  it('closes projection without calling blackout or foreground', () => {
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: 'Close Projection' }))

    expect(mocks.actions.closeProjection).toHaveBeenCalledOnce()
    expect(mocks.actions.blackoutProjection).not.toHaveBeenCalled()
    expect(mocks.actions.bringProjectionToFront).not.toHaveBeenCalled()
  })
})
