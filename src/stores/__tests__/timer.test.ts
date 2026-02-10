import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { useTimerStore } from '../timer'
import { TimerMode } from '@/types/common'

describe('Timer Store', () => {
  beforeEach(() => {
    setActivePinia(
      createTestingPinia({
        createSpy: vi.fn,
        stubActions: false,
      }),
    )
  })

  it('should instantiate timer store with default settings', () => {
    const store = useTimerStore()

    expect(store).toBeDefined()
    expect(store.settings).toBeDefined()
    expect(store.presets).toBeDefined()
    expect(store.state).toBe('stopped')
  })

  it('should have initial timer state as stopped', () => {
    const store = useTimerStore()

    expect(store.state).toBe('stopped')
    expect(store.isRunning).toBe(false)
  })

  it('should have default timer mode', () => {
    const store = useTimerStore()

    expect(store.settings.mode).toBeDefined()
    expect(Object.values(TimerMode)).toContain(store.settings.mode)
  })

  it('should format time correctly', () => {
    const store = useTimerStore()

    expect(store.formattedTime).toBeDefined()
    expect(typeof store.formattedTime).toBe('string')
    expect(store.formattedTime).toMatch(/^\d{2}:\d{2}(:\d{2})?$/)
  })

  it('should calculate progress correctly', () => {
    const store = useTimerStore()

    expect(store.progress).toBeDefined()
    expect(typeof store.progress).toBe('number')
    expect(store.progress).toBeGreaterThanOrEqual(0)
    expect(store.progress).toBeLessThanOrEqual(100)
  })
})
