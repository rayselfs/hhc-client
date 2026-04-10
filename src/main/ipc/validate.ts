import { BrowserWindow } from 'electron'

const VALID_TIMER_COMMAND_TYPES = new Set([
  'start',
  'pause',
  'resume',
  'reset',
  'setDuration',
  'addTime',
  'removeTime',
  'setMode',
  'setReminder',
  'setOvertimeMessage',
  'startStopwatch',
  'pauseStopwatch',
  'resetStopwatch'
])

const VALID_TIMER_MODES = new Set(['timer', 'clock', 'both', 'stopwatch'])

const MAX_DURATION_SECONDS = 86400

export function validateSender(event: Electron.IpcMainInvokeEvent): boolean {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win !== null
}

export function validateTimerCommand(cmd: unknown): boolean {
  if (typeof cmd !== 'object' || cmd === null) return false
  const obj = cmd as Record<string, unknown>
  if (typeof obj.type !== 'string') return false
  return VALID_TIMER_COMMAND_TYPES.has(obj.type)
}

export function validateTimerSettings(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null) return false
  const obj = settings as Record<string, unknown>

  if (typeof obj.mode !== 'string' || !VALID_TIMER_MODES.has(obj.mode)) return false

  if (
    typeof obj.totalDuration !== 'number' ||
    obj.totalDuration < 0 ||
    obj.totalDuration > MAX_DURATION_SECONDS
  )
    return false

  if (typeof obj.reminderEnabled !== 'boolean') return false

  if (
    typeof obj.reminderDuration !== 'number' ||
    obj.reminderDuration < 0 ||
    obj.reminderDuration > MAX_DURATION_SECONDS
  )
    return false

  if (typeof obj.reminderColor !== 'string') return false

  if (typeof obj.overtimeMessageEnabled !== 'boolean') return false

  if (typeof obj.overtimeMessage !== 'string') return false

  if (typeof obj.timezone !== 'string') return false

  return true
}
