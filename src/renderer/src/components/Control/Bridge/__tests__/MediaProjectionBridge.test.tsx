import { render, waitFor } from '@testing-library/react'
import MediaProjectionBridge from '../MediaProjectionBridge'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

const mocks = vi.hoisted(() => ({
  projection: {
    isProjectionOpen: true,
    activeOwner: 'media',
    recovery: { status: 'ready', generation: 1, failure: null },
    on: vi.fn(() => vi.fn())
  },
  sync: vi.fn()
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => mocks.projection
}))

vi.mock('@renderer/lib/media-projection-sync', () => ({
  useMediaProjectionSync: mocks.sync
}))

vi.mock('@renderer/contexts/HhcAuthContext', () => ({
  useHhcAuth: () => ({
    session: { userId: 'user-1', displayName: 'Ada', roles: [] },
    getAccessToken: vi.fn(),
    refreshAccessToken: vi.fn()
  })
}))

const originalMarkProjectionClosed = useMediaProjectionStore.getState().markProjectionClosed

describe('MediaProjectionBridge', () => {
  afterEach(() => {
    useMediaProjectionStore.setState({
      markProjectionClosed: originalMarkProjectionClosed,
      playlist: []
    })
  })

  it('clears retained Media state once after an external projection close', async () => {
    const markProjectionClosed = vi.fn()
    useMediaProjectionStore.setState({
      playlist: [
        {
          id: 'image-1',
          parentId: 'root',
          type: 'file',
          sortIndex: 0,
          createdAt: 1,
          expiresAt: null,
          name: 'Photo.png',
          url: 'blob:image-1',
          size: 10,
          mimeType: 'image/png'
        }
      ],
      markProjectionClosed
    })
    Object.assign(mocks.projection, {
      isProjectionOpen: false,
      activeOwner: 'media',
      recovery: { status: 'closed', generation: 1, failure: null }
    })

    render(<MediaProjectionBridge />)

    await waitFor(() => expect(markProjectionClosed).toHaveBeenCalledOnce())
  })

  it('does not clear a live Media session while projection remains open', () => {
    const markProjectionClosed = vi.fn()
    useMediaProjectionStore.setState({ markProjectionClosed })
    Object.assign(mocks.projection, {
      isProjectionOpen: true,
      activeOwner: 'media',
      recovery: { status: 'ready', generation: 1, failure: null }
    })

    render(<MediaProjectionBridge />)

    expect(markProjectionClosed).not.toHaveBeenCalled()
  })

  it('passes the current auth facade and narrow access-revoked callback to media sync', () => {
    const onHhcAccessRevoked = vi.fn()
    render(<MediaProjectionBridge onHhcAccessRevoked={onHhcAccessRevoked} />)

    expect(mocks.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({ getSession: expect.any(Function) }),
        onAccessRevoked: onHhcAccessRevoked
      })
    )
  })
})
