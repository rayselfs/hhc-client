import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  InspectorPanel,
  NavigatorRail,
  ResponsivePanelGroup,
  StageViewport
} from '../WorkspacePrimitives'

describe('ResponsivePanelGroup', () => {
  afterEach(() => vi.restoreAllMocks())

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
    expect(container.querySelector('.workspace-inspector-slot')).not.toHaveAttribute(
      'role',
      'dialog'
    )
    expect(container.querySelector('.workspace-stage-slot')).not.toHaveAttribute('inert')
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

  it('contains focus in a labelled compact overlay and hides background panes', async () => {
    mockCompactViewport()
    const user = userEvent.setup()
    const { container } = render(
      <ResponsivePanelGroup
        navigatorLabel="Slides"
        inspectorLabel="Format"
        navigator={
          <NavigatorRail>
            <button type="button">Slide 1</button>
          </NavigatorRail>
        }
        stage={
          <StageViewport>
            <button type="button">Stage action</button>
          </StageViewport>
        }
        inspector={
          <InspectorPanel>
            <button type="button">Apply format</button>
          </InspectorPanel>
        }
      />
    )

    const trigger = screen.getByRole('button', { name: 'Slides' })
    await user.click(trigger)

    const overlay = screen.getByRole('dialog', { name: 'Slides' })
    const close = within(overlay).getByRole('button', { name: 'Close Slides' })
    const internalInspectorSwitch = within(overlay).getByRole('button', { name: 'Format' })
    const stage = container.querySelector('.workspace-stage-slot')
    const inspector = container.querySelector('.workspace-inspector-slot')
    expect(stage).toHaveAttribute('inert')
    expect(stage).toHaveAttribute('aria-hidden', 'true')
    expect(inspector).toHaveAttribute('inert')
    expect(inspector).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button', { name: 'Stage action' })).not.toBeInTheDocument()
    await waitFor(() => expect(close).toHaveFocus())

    await user.click(internalInspectorSwitch)
    expect(screen.getByRole('dialog', { name: 'Format' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Format' })).toHaveFocus())
    expect(stage).not.toHaveAttribute('inert')
    expect(stage).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('button', { name: 'Stage action' })).toBeEnabled()
  })

  it('moves compact overlay focus and isolation when switching panes', async () => {
    mockCompactViewport()
    const user = userEvent.setup()
    const { container } = render(
      <ResponsivePanelGroup
        navigatorLabel="Slides"
        inspectorLabel="Format"
        navigator={<NavigatorRail>Slide navigator</NavigatorRail>}
        stage={<StageViewport>Editing stage</StageViewport>}
        inspector={<InspectorPanel>Format inspector</InspectorPanel>}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Slides' }))
    await user.click(
      within(screen.getByRole('dialog', { name: 'Slides' })).getByRole('button', {
        name: 'Format'
      })
    )

    const overlay = screen.getByRole('dialog', { name: 'Format' })
    await waitFor(() =>
      expect(within(overlay).getByRole('button', { name: 'Close Format' })).toHaveFocus()
    )
    expect(container.querySelector('.workspace-navigator-slot')).toHaveAttribute('inert')
    expect(container.querySelector('.workspace-navigator-slot')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(container.querySelector('.workspace-inspector-slot')).toHaveAttribute('inert')
  })

  it('hands focus from a disappearing compact close button to the docked pane', async () => {
    const setViewportWidth = mockCompactViewport()
    const user = userEvent.setup()
    const { container } = render(
      <ResponsivePanelGroup
        navigatorLabel="Slides"
        inspectorLabel="Format"
        navigator={<NavigatorRail>Slide navigator</NavigatorRail>}
        stage={<StageViewport>Editing stage</StageViewport>}
        inspector={
          <InspectorPanel>
            <button type="button">Apply format</button>
          </InspectorPanel>
        }
      />
    )

    await user.click(screen.getByRole('button', { name: 'Format' }))
    const close = screen.getByRole('button', { name: 'Close Format' })
    await waitFor(() => expect(close).toHaveFocus())

    act(() => setViewportWidth(1400))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply format' })).toHaveFocus())
    expect(container.querySelector('.workspace-inspector-slot')).not.toHaveAttribute(
      'role',
      'dialog'
    )
    expect(container.querySelector('.workspace-stage-slot')).not.toHaveAttribute('inert')

    act(() => setViewportWidth(900))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close Format' })).toHaveFocus())
    screen.getByRole('button', { name: 'Apply format' }).focus()

    act(() => setViewportWidth(1400))

    expect(screen.getByRole('button', { name: 'Apply format' })).toHaveFocus()
  })

  it('keeps inspector state and DOM identity while moving between modal and dock', async () => {
    const setViewportWidth = mockCompactViewport()
    const user = userEvent.setup()
    render(
      <ResponsivePanelGroup
        navigatorLabel="Slides"
        inspectorLabel="Format"
        navigator={<NavigatorRail>Slide navigator</NavigatorRail>}
        stage={<StageViewport>Editing stage</StageViewport>}
        inspector={<StatefulInspector />}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Format' }))
    const inspector = screen.getByTestId('stateful-inspector')
    await user.click(screen.getByRole('button', { name: 'Gradient stop 2' }))
    expect(screen.getByRole('button', { name: 'Gradient stop 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    act(() => setViewportWidth(1400))
    expect(screen.getByTestId('stateful-inspector')).toBe(inspector)
    expect(screen.getByRole('button', { name: 'Gradient stop 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getAllByTestId('stateful-inspector')).toHaveLength(1)

    act(() => setViewportWidth(900))
    expect(screen.getByTestId('stateful-inspector')).toBe(inspector)
    expect(screen.getByRole('button', { name: 'Gradient stop 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('keeps navigator selection, scroll, and DOM identity across modal reparenting', async () => {
    const setViewportWidth = mockCompactViewport()
    const user = userEvent.setup()
    render(
      <ResponsivePanelGroup
        navigatorLabel="Slides"
        navigator={<StatefulNavigator />}
        stage={<StageViewport>Editing stage</StageViewport>}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Slides' }))
    const navigator = screen.getByTestId('stateful-navigator')
    navigator.scrollTop = 72
    await user.click(screen.getByRole('button', { name: 'Slide 2' }))

    act(() => setViewportWidth(1400))
    expect(screen.getByTestId('stateful-navigator')).toBe(navigator)
    expect(navigator.scrollTop).toBe(72)
    expect(screen.getByRole('button', { name: 'Slide 2' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getAllByTestId('stateful-navigator')).toHaveLength(1)

    act(() => setViewportWidth(900))
    expect(screen.getByTestId('stateful-navigator')).toBe(navigator)
    expect(navigator.scrollTop).toBe(72)
    expect(screen.getByRole('button', { name: 'Slide 2' })).toHaveAttribute('aria-current', 'true')
  })
})

function StatefulInspector(): React.JSX.Element {
  const [selectedStop, setSelectedStop] = useState(0)
  return (
    <InspectorPanel data-testid="stateful-inspector">
      {[0, 1].map((index) => (
        <button
          key={index}
          type="button"
          aria-label={`Gradient stop ${index + 1}`}
          aria-pressed={selectedStop === index}
          onClick={() => setSelectedStop(index)}
        />
      ))}
    </InspectorPanel>
  )
}

function StatefulNavigator(): React.JSX.Element {
  const [selectedSlide, setSelectedSlide] = useState(0)
  return (
    <NavigatorRail data-testid="stateful-navigator" className="overflow-auto">
      {[0, 1].map((index) => (
        <button
          key={index}
          type="button"
          aria-label={`Slide ${index + 1}`}
          aria-current={selectedSlide === index ? 'true' : undefined}
          onClick={() => setSelectedSlide(index)}
        />
      ))}
    </NavigatorRail>
  )
}

function mockCompactViewport(initialWidth = 900): (width: number) => void {
  let width = initialWidth
  const media = new Map<
    string,
    MediaQueryList & { listeners: Set<(event: MediaQueryListEvent) => void> }
  >()
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    const existing = media.get(query)
    if (existing) return existing
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const maxWidth = Number.parseInt(query.match(/max-width:\s*(\d+)px/)?.[1] ?? '0', 10)
    const result = {
      get matches() {
        return width <= maxWidth
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener)
      ),
      removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener)
      ),
      dispatchEvent: vi.fn(() => false),
      listeners
    } as MediaQueryList & { listeners: Set<(event: MediaQueryListEvent) => void> }
    media.set(query, result)
    return result
  })
  return (nextWidth) => {
    const previousWidth = width
    width = nextWidth
    media.forEach((query) => {
      const maxWidth = Number.parseInt(query.media.match(/max-width:\s*(\d+)px/)?.[1] ?? '0', 10)
      const previousMatches = previousWidth <= maxWidth
      if (query.matches === previousMatches) return
      const event = { matches: query.matches, media: query.media } as MediaQueryListEvent
      query.listeners.forEach((listener) => listener(event))
    })
  }
}
