import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  IpcInvokeChannel,
  IpcInvokeMap,
  IpcMainToRendererChannel,
  IpcMainToRendererMap,
  UpdateStatus,
  WhisperModel,
  WhisperDownloadProgress,
  WhisperDirInfo
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
  ensure: (displayId?: string) => typedInvoke('projection:ensure', displayId),
  moveToDisplay: (displayId: string) => typedInvoke('projection:move-to-display', displayId),
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
  getContent: (versionId: number) => typedInvoke('bible:get-content', versionId)
}

const appApi = {
  relaunch: () => typedInvoke('app:relaunch'),
  selectDirectory: () => typedInvoke('app:select-directory'),
  setModelDir: (dir: string) => typedInvoke('app:set-model-dir', dir),
  checkWhisperDir: (dir: string): Promise<WhisperDirInfo> =>
    typedInvoke('app:check-whisper-dir', dir),
  downloadWhisperModel: (model: WhisperModel, destDir: string) =>
    typedInvoke('app:download-whisper-model', model, destDir),
  onDownloadProgress: (callback: (data: WhisperDownloadProgress) => void) =>
    typedOn('app:download-progress', callback)
}

const updateApi = {
  checkForUpdates: () => typedInvoke('update:check'),
  downloadAndInstall: () => typedInvoke('update:download-and-install'),
  onStatusChanged: (
    callback: (data: { status: UpdateStatus; version?: string; error?: string }) => void
  ) => typedOn('update:status-changed', callback)
}

const speechApi = {
  saveKey: (provider: string, apiKey: string) => typedInvoke('speech:saveKey', provider, apiKey),
  loadKey: (provider: string) => typedInvoke('speech:loadKey', provider),
  deleteKey: (provider: string) => typedInvoke('speech:deleteKey', provider)
}

const nativeFsApi = {
  importFile: (id: string, file: File) => {
    const sourcePath = webUtils.getPathForFile(file)
    return typedInvoke('native-fs:import-file', id, sourcePath)
  },
  getUrl: (id: string, mimeType: string) =>
    `hhc-media://file/${encodeURIComponent(id)}?type=${encodeURIComponent(mimeType)}`,
  delete: (id: string) => typedInvoke('native-fs:delete-file', id)
}

const videoPosterApi = {
  getInfo: () => typedInvoke('video-poster:get-info'),
  generate: (request: IpcInvokeMap['video-poster:generate']['args'][0]) =>
    typedInvoke('video-poster:generate', request)
}

const projectionVlcApi = {
  getInfo: () => typedInvoke('projection-vlc:get-info'),
  start: (request: IpcInvokeMap['projection-vlc:start']['args'][0]) =>
    typedInvoke('projection-vlc:start', request),
  probe: (request: IpcInvokeMap['projection-vlc:probe']['args'][0]) =>
    typedInvoke('projection-vlc:probe', request),
  control: (command: IpcInvokeMap['projection-vlc:control']['args'][0]) =>
    typedInvoke('projection-vlc:control', command),
  stop: () => typedInvoke('projection-vlc:stop')
}

const localSyncApi = {
  selectFolder: () => typedInvoke('local-sync:select-folder'),
  listFolders: () => typedInvoke('local-sync:list-folders'),
  scanFolder: (connectionId: string) => typedInvoke('local-sync:scan-folder', connectionId),
  importFile: (request: IpcInvokeMap['local-sync:import-file']['args'][0]) =>
    typedInvoke('local-sync:import-file', request),
  startWatch: (connectionId: string) => typedInvoke('local-sync:start-watch', connectionId),
  getWatchStatus: (connectionId: string) =>
    typedInvoke('local-sync:get-watch-status', connectionId),
  stopWatch: (connectionId: string) => typedInvoke('local-sync:stop-watch', connectionId),
  disconnectFolder: (connectionId: string) =>
    typedInvoke('local-sync:disconnect-folder', connectionId)
}

const oneDriveApi = {
  saveCredentials: (input: IpcInvokeMap['onedrive:save-credentials']['args'][0]) =>
    typedInvoke('onedrive:save-credentials', input),
  getCredentialStatus: (connectionId: string) =>
    typedInvoke('onedrive:get-credential-status', connectionId),
  getAccessToken: (request: IpcInvokeMap['onedrive:get-access-token']['args'][0]) =>
    typedInvoke('onedrive:get-access-token', request),
  exchangeAuthCode: (request: IpcInvokeMap['onedrive:exchange-auth-code']['args'][0]) =>
    typedInvoke('onedrive:exchange-auth-code', request),
  deleteCredentials: (connectionId: string) =>
    typedInvoke('onedrive:delete-credentials', connectionId),
  startAuthCallback: () => typedInvoke('onedrive:start-auth-callback'),
  waitAuthCallback: (callbackId: string) => typedInvoke('onedrive:wait-auth-callback', callbackId),
  cancelAuthCallback: (callbackId: string) =>
    typedInvoke('onedrive:cancel-auth-callback', callbackId),
  downloadFile: (request: IpcInvokeMap['onedrive:download-file']['args'][0]) =>
    typedInvoke('onedrive:download-file', request)
}

const api = {
  projection: projectionApi,
  theme: themeApi,
  timer: timerApi,
  bible: bibleApi,
  app: appApi,
  update: updateApi,
  speech: speechApi,
  nativeFs: nativeFsApi,
  videoPoster: videoPosterApi,
  projectionVlc: projectionVlcApi,
  localSync: localSyncApi,
  oneDrive: oneDriveApi
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('Failed to expose API via contextBridge:', error)
}
