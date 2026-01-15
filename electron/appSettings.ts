import Store from 'electron-store'

interface AppSettings {
  hardwareAcceleration: boolean
}

const defaults: AppSettings = {
  hardwareAcceleration: true,
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
