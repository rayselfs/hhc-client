import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
})
