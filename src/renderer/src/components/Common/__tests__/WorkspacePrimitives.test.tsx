import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  InspectorPanel,
  NavigatorRail,
  ResponsivePanelGroup,
  StageViewport
} from '../WorkspacePrimitives'

describe('ResponsivePanelGroup', () => {
  it('keeps one primary stage and exposes mutually exclusive panel sheets', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ResponsivePanelGroup
        navigatorLabel="Slides"
        inspectorLabel="Format"
        navigator={
          <NavigatorRail>
            <span>Slide navigator</span>
          </NavigatorRail>
        }
        stage={
          <StageViewport>
            <span>Editing stage</span>
          </StageViewport>
        }
        inspector={
          <InspectorPanel>
            <span>Format inspector</span>
          </InspectorPanel>
        }
      />
    )

    expect(screen.getByText('Editing stage')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Slides' }))
    expect(container.querySelector('.workspace-navigator-slot')).toHaveClass(
      'workspace-overlay-open'
    )

    await user.click(screen.getByRole('button', { name: 'Format' }))
    expect(container.querySelector('.workspace-navigator-slot')).not.toHaveClass(
      'workspace-overlay-open'
    )
    expect(container.querySelector('.workspace-inspector-slot')).toHaveClass(
      'workspace-overlay-open'
    )
  })

  it('uses a controlled overlay value and reports trigger and close changes', async () => {
    const user = userEvent.setup()
    const onOverlayChange = vi.fn()
    const { container, rerender } = render(
      <ResponsivePanelGroup
        overlay="inspector"
        onOverlayChange={onOverlayChange}
        navigatorLabel="Slides"
        inspectorLabel="Format"
        navigator={<NavigatorRail>Slide navigator</NavigatorRail>}
        stage={<StageViewport>Editing stage</StageViewport>}
        inspector={<InspectorPanel>Format inspector</InspectorPanel>}
      />
    )

    expect(container.querySelector('.workspace-inspector-slot')).toHaveClass(
      'workspace-overlay-open'
    )
    await user.click(screen.getByRole('button', { name: 'Slides' }))
    expect(onOverlayChange).toHaveBeenLastCalledWith('navigator')
    expect(container.querySelector('.workspace-inspector-slot')).toHaveClass(
      'workspace-overlay-open'
    )

    rerender(
      <ResponsivePanelGroup
        overlay="navigator"
        onOverlayChange={onOverlayChange}
        navigatorLabel="Slides"
        inspectorLabel="Format"
        navigator={<NavigatorRail>Slide navigator</NavigatorRail>}
        stage={<StageViewport>Editing stage</StageViewport>}
        inspector={<InspectorPanel>Format inspector</InspectorPanel>}
      />
    )
    expect(container.querySelector('.workspace-navigator-slot')).toHaveClass(
      'workspace-overlay-open'
    )

    await user.click(screen.getByRole('button', { name: 'Close Slides' }))
    expect(onOverlayChange).toHaveBeenLastCalledWith(null)
  })

  it('returns focus to the navigator trigger after its overlay closes', async () => {
    const user = userEvent.setup()
    render(
      <ResponsivePanelGroup
        navigatorLabel="Playlist"
        navigator={<NavigatorRail>Playlist navigator</NavigatorRail>}
        stage={<StageViewport>Media stage</StageViewport>}
      />
    )
    const trigger = screen.getByRole('button', { name: 'Playlist' })
    await user.click(trigger)

    await user.click(screen.getByRole('button', { name: 'Close Playlist' }))

    expect(trigger).toHaveFocus()
  })
})
