import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MediaPreview from '../MediaPreview'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

const toastMocks = vi.hoisted(() => ({ danger: vi.fn() }))

vi.mock('@heroui/react/toast', () => ({ toast: toastMocks }))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('MediaPreview', () => {
  const originalNext = useMediaProjectionStore.getState().next

  afterEach(() => {
    useMediaProjectionStore.setState({ next: originalNext } as never)
    vi.clearAllMocks()
  })
  it('delegates an end-screen click to the workspace close transaction', () => {
    const onExit = vi.fn()
    render(<MediaPreview currentItem={null} descriptor={null} isEnded onExit={onExit} />)

    fireEvent.click(screen.getByText('presenter.endOfSlides'))

    expect(onExit).toHaveBeenCalledOnce()
  })

  it('shows the existing save failure toast only when click-to-advance is blocked', async () => {
    useMediaProjectionStore.setState({ next: vi.fn(async () => ({ status: 'blocked' })) } as never)
    render(
      <MediaPreview
        currentItem={null}
        descriptor={{ clickToAdvance: true } as never}
        onExit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('presenter.noMediaSelected'))

    await waitFor(() => expect(toastMocks.danger).toHaveBeenCalledOnce())
  })

  it('keeps superseded click-to-advance quiet', async () => {
    useMediaProjectionStore.setState({
      next: vi.fn(async () => ({ status: 'superseded' }))
    } as never)
    render(
      <MediaPreview
        currentItem={null}
        descriptor={{ clickToAdvance: true } as never}
        onExit={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('presenter.noMediaSelected'))

    await Promise.resolve()
    expect(toastMocks.danger).not.toHaveBeenCalled()
  })
})
