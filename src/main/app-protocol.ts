import { app } from 'electron'

const HHC_PRESENTER_PROTOCOL = 'hhc-presenter'

export function registerAppProtocol(): void {
  if (process.platform === 'win32' && process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(HHC_PRESENTER_PROTOCOL, process.execPath, [process.argv[1]])
    return
  }
  app.setAsDefaultProtocolClient(HHC_PRESENTER_PROTOCOL)
}
