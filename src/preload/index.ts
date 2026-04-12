import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcInvokeChannel,
  IpcInvokeMap,
  IpcMainToRendererChannel,
  IpcMainToRendererMap
} from '../shared/ipc-channels'
import type { ProjectionChannel, ProjectionPayload } from '../shared/projection-messages'
import type { TimerTickPayload } from '../shared/types/timer'

function typedInvoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeMap[C]['args']
): Promise<IpcInvokeMap[C]['result']> {
  return ipcRenderer.invoke(channel, ...args)
}

function typedOn<C extends IpcMainToRendererChannel>(
  channel: C,
  handler: (...args: IpcMainToRendererMap[C]) => void
): () => void {
  const wrappedHandler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
    handler(...(args as IpcMainToRendererMap[C]))
  }
  ipcRenderer.on(channel, wrappedHandler)
  return () => ipcRenderer.removeListener(channel, wrappedHandler)
}

const themeApi = {
  get: () => typedInvoke('theme:get'),
  set: (theme: 'light' | 'dark' | 'system') => typedInvoke('theme:set', theme),
  onChanged: (callback: (data: { shouldUseDarkColors: boolean }) => void) =>
    typedOn('theme:changed', callback)
}

const projectionApi = {
  check: () => typedInvoke('projection:check'),
  ensure: () => typedInvoke('projection:ensure'),
  close: () => typedInvoke('projection:close'),
  send: <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>) =>
    ipcRenderer.send('projection:send', channel, data),
  sendToMain: <C extends ProjectionChannel>(channel: C, data: ProjectionPayload<C>) =>
    ipcRenderer.send('projection:send-to-main', channel, data),
  getDisplays: () => typedInvoke('projection:get-displays'),
  onProjectionMessage: (
    callback: (channel: ProjectionChannel, data: ProjectionPayload<ProjectionChannel>) => void
  ) => typedOn('projection:message', callback),
  onProjectionOpened: (callback: () => void) => typedOn('projection:opened', callback),
  onProjectionClosed: (callback: () => void) => typedOn('projection:closed', callback)
}

const timerApi = {
  timerCommand: (cmd: IpcInvokeMap['timer:command']['args'][0]) =>
    typedInvoke('timer:command', cmd),
  timerGetState: () => typedInvoke('timer:get-state'),
  timerInitialize: (settings: IpcInvokeMap['timer:initialize']['args'][0]) =>
    typedInvoke('timer:initialize', settings),
  onTimerTick: (callback: (payload: TimerTickPayload) => void) => typedOn('timer-tick', callback)
}

const bibleApi = {
  getVersions: () => typedInvoke('bible:get-versions'),
  getContent: (versionId: string) => typedInvoke('bible:get-content', versionId)
}

const api = { projection: projectionApi, theme: themeApi, timer: timerApi, bible: bibleApi }

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('Failed to expose API via contextBridge:', error)
}
