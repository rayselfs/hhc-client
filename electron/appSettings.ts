import Store from 'electron-store'

export type VideoQuality = 'low' | 'medium' | 'high'

interface AppSettings {
  hardwareAcceleration: boolean
  videoQuality: VideoQuality
  enableFfmpeg: boolean
  customFfmpegPath: string
}

const defaults: AppSettings = {
  hardwareAcceleration: true,
  videoQuality: 'high',
  enableFfmpeg: false,
  customFfmpegPath: '',
}

export const appSettings = new Store<AppSettings>({
  name: 'app-settings',
  defaults,
})

export function getHardwareAcceleration(): boolean {
  return appSettings.get('hardwareAcceleration', true)
}

export function setHardwareAcceleration(enabled: boolean): void {
  appSettings.set('hardwareAcceleration', enabled)
}

export function getVideoQuality(): VideoQuality {
  return appSettings.get('videoQuality', 'high')
}

export function setVideoQuality(quality: VideoQuality): void {
  appSettings.set('videoQuality', quality)
}

export function getEnableFfmpeg(): boolean {
  return appSettings.get('enableFfmpeg', false)
}

export function setEnableFfmpeg(enabled: boolean): void {
  appSettings.set('enableFfmpeg', enabled)
}

export function getCustomFfmpegPath(): string {
  return appSettings.get('customFfmpegPath', '')
}

export function setCustomFfmpegPath(path: string): void {
  appSettings.set('customFfmpegPath', path)
}
