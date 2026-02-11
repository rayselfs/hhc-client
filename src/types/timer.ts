import type { BaseMessage } from './projection'
import { MessageType } from './projection'

/**
 * Timer Mode Enum
 */
export enum TimerMode {
  TIMER = 'timer',
  CLOCK = 'clock',
  BOTH = 'both',
}

/**
 * Timer Preset Interface
 */
export interface TimerPreset {
  id: string
  name: string
  duration: number
  mode: TimerMode
}

/**
 * Timer Tick Message (High frequency tick)
 */
export interface TimerTickMessage extends BaseMessage {
  type: MessageType.TIMER_TICK
  data: {
    mode: TimerMode
    duration: number
    remainingTime: number
    isRunning: boolean
    progress: number
  }
}

/**
 * Timer Sync Settings Message (Broadcast settings)
 */
export interface TimerSyncSettingsMessage extends BaseMessage {
  type: MessageType.TIMER_SYNC_SETTINGS
  data: {
    mode: TimerMode
    timerDuration: number
    timezone: string
    isRunning: boolean
    remainingTime: number
    formattedTime: string
    progress: number
    overtimeMessageEnabled?: boolean
    overtimeMessage?: string
    reminderEnabled?: boolean
    reminderTime?: number
  }
}

/**
 * Timezone Update Message - Note: This uses TIMER_SYNC_SETTINGS message type but has a different data shape (just timezone).
 * It might be better to merge this concept or keep it as a specific payload type if handled differently.
 * For now, just updating the enum.
 */
export interface TimezoneUpdateMessage extends BaseMessage {
  type: MessageType.TIMER_SYNC_SETTINGS
  data: {
    timezone: string
  }
}
