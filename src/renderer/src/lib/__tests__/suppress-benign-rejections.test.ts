import { describe, expect, it, vi } from 'vitest'
import {
  isBenignTransitionAbort,
  suppressBenignTransitionAbortErrors
} from '../suppress-benign-rejections'

function createUnhandledRejectionEvent(reason: unknown): PromiseRejectionEvent {
  const event = new Event('unhandledrejection') as PromiseRejectionEvent
  Object.defineProperty(event, 'reason', {
    value: reason
  })
  return event
}

describe('suppressBenignTransitionAbortErrors', () => {
  it('identifies skipped transition abort errors', () => {
    expect(isBenignTransitionAbort(new DOMException('Transition was skipped', 'AbortError'))).toBe(
      true
    )
  })

  it('suppresses skipped transition abort rejections', () => {
    const cleanup = suppressBenignTransitionAbortErrors(window)
    const event = createUnhandledRejectionEvent(
      new DOMException('Transition was skipped', 'AbortError')
    )
    const preventDefault = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(preventDefault).toHaveBeenCalledOnce()
    cleanup()
  })

  it('does not suppress unrelated rejections', () => {
    const cleanup = suppressBenignTransitionAbortErrors(window)
    const event = createUnhandledRejectionEvent(new Error('real failure'))
    const preventDefault = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(preventDefault).not.toHaveBeenCalled()
    cleanup()
  })
})
