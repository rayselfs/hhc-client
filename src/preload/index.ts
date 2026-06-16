import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  IpcInvokeChannel,
  IpcInvokeMap,
  IpcMainToRendererChannel,
  IpcMainToRendererMap,
  UpdateStatus,
  WhisperModel,
  WhisperDownloadProgress,
  WhisperDirInfo,
  FfmpegConfigInfo
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

const videoTranscodeApi = {
  getFfmpegConfig: (): Promise<FfmpegConfigInfo> =>
    typedInvoke('video-transcode:get-ffmpeg-config'),
  selectFfmpeg: (): Promise<FfmpegConfigInfo | null> =>
    typedInvoke('video-transcode:select-ffmpeg'),
  validateFfmpeg: (): Promise<FfmpegConfigInfo> => typedInvoke('video-transcode:validate-ffmpeg'),
  removeFfmpegConfig: (): Promise<FfmpegConfigInfo> =>
    typedInvoke('video-transcode:remove-ffmpeg-config'),
  run: (request: IpcInvokeMap['video-transcode:run']['args'][0]) =>
    typedInvoke('video-transcode:run', request),
  cancel: (jobId: string) => typedInvoke('video-transcode:cancel', jobId)
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
  videoTranscode: videoTranscodeApi
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('Failed to expose API via contextBridge:', error)
}
