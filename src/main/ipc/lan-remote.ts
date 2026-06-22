import { ipcMain } from 'electron'
import { sanitizeLanRemoteSnapshot, type LanRemoteAck } from '../../shared/lan-remote'
import type { IpcInvokeMap } from '../../shared/ipc-channels'
import { createLanRemoteServer } from '../lan-remote/server'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

function isStartOptions(value: unknown): value is IpcInvokeMap['lan-remote:start']['args'][0] {
  if (typeof value !== 'object' || value === null) return false
  const options = value as Record<string, unknown>
  return (
    typeof options.host === 'string' &&
    typeof options.port === 'number' &&
    Number.isInteger(options.port) &&
    options.port >= 0 &&
    options.port <= 65535
  )
}

function isLanRemoteAck(value: unknown): value is LanRemoteAck {
  if (typeof value !== 'object' || value === null) return false
  const ack = value as Record<string, unknown>
  if (typeof ack.requestId !== 'string') return false
  if (ack.status === 'accepted') return true
  return ack.status === 'rejected' && typeof ack.reason === 'string'
}

export function registerLanRemoteIpc(wm: WindowManager): void {
  const server = createLanRemoteServer({
    commandHandler: async (command) => {
      wm.sendToMain('lan-remote:command', command)
      return { requestId: command.requestId, status: 'accepted' }
    }
  })

  ipcMain.handle('lan-remote:start', async (event, options: unknown) => {
    if (!isMainWindow(wm, event)) return server.getStatus()
    if (!isStartOptions(options)) return server.getStatus()
    await server.start(options)
    return server.getStatus()
  })

  ipcMain.handle('lan-remote:stop', async (event) => {
    if (!isMainWindow(wm, event)) return server.getStatus()
    await server.stop()
    return server.getStatus()
  })

  ipcMain.handle('lan-remote:get-status', (event) => {
    if (!isMainWindow(wm, event)) return server.getStatus()
    return server.getStatus()
  })

  ipcMain.handle('lan-remote:create-pairing', (event, deviceName: unknown) => {
    if (!isMainWindow(wm, event) || typeof deviceName !== 'string') {
      throw new Error('Invalid LAN remote pairing request')
    }
    return server.createPairingSecret(deviceName)
  })

  ipcMain.handle('lan-remote:publish-state', (event, snapshot: unknown) => {
    if (!isMainWindow(wm, event)) return
    server.publishState(sanitizeLanRemoteSnapshot(snapshot))
  })

  ipcMain.handle('lan-remote:publish-ack', (event, ack: unknown) => {
    if (!isMainWindow(wm, event) || !isLanRemoteAck(ack)) return
    server.publishAck(ack)
    wm.sendToMain('lan-remote:ack', ack)
  })
}
