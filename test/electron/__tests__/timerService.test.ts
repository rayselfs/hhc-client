import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TimerService } from '../../../electron/timerService'
import type { TimerCommand } from '../../../electron/timerService'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => ({
    webContents: {
      send: vi.fn(),
    },
    isDestroyed: vi.fn(() => false),
  })),
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
  },
}))

describe('TimerService', () => {
  let timerService: TimerService

  beforeEach(() => {
    vi.useFakeTimers()
    timerService = new TimerService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should instantiate TimerService with default state', () => {
    expect(timerService).toBeDefined()
    expect(typeof timerService.handleCommand).toBe('function')
    expect(typeof timerService.getState).toBe('function')
  })

  it('should return initial state with stopped timer', () => {
    const state = timerService.getState()
    
    expect(state).toBeDefined()
    expect(state.state).toBe('stopped')
    expect(state.remainingTime).toBeGreaterThan(0)
    expect(state.timerDuration).toBeGreaterThan(0)
  })

  it('should handle setDuration command', () => {
    const command: TimerCommand = {
      action: 'setDuration',
      duration: 600,
    }
    
    timerService.handleCommand(command)
    const state = timerService.getState()
    
    expect(state.originalDuration).toBe(600)
    expect(state.remainingTime).toBe(600)
  })

  it('should handle start command', () => {
    timerService.handleCommand({ action: 'start' })
    const state = timerService.getState()
    
    expect(state.state).toBe('running')
  })

  it('should handle pause command when running', () => {
    timerService.handleCommand({ action: 'start' })
    timerService.handleCommand({ action: 'pause' })
    const state = timerService.getState()
    
    expect(state.state).toBe('paused')
  })

  it('should handle reset command', () => {
    timerService.handleCommand({ action: 'start' })
    timerService.handleCommand({ action: 'reset' })
    const state = timerService.getState()
    
    expect(state.state).toBe('stopped')
    expect(state.remainingTime).toBe(state.originalDuration)
  })
})
