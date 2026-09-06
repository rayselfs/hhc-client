import { build } from 'esbuild'
import { chromium, _electron as electron } from '@playwright/test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

// Isolated diagnostic only; synthetic mode never proves physical camera compatibility.
const synthetic = process.argv.includes('--synthetic')
const desktop = process.argv.includes('--electron')
const root = process.cwd()
const source = `
import { createCameraSession } from './src/renderer/src/lib/camera-session'
import { createCameraPeer } from './src/renderer/src/lib/camera-peer'
import { createProjectionAdapter } from './src/renderer/src/lib/projection-adapter'
const role = new URLSearchParams(location.search).get('role')
const adapter = createProjectionAdapter(role, 'camera-probe')
adapter.setGeneration(1)
const session = createCameraSession()
const video = document.querySelector('video')
const errors = []
let received = 0
let frames = 0
let sourceTrack
let peer
let rtc
function attach(stream) {
  video.srcObject = stream
  void video.play().catch(e => errors.push(e.message))
  function frame() { frames++; video.requestVideoFrameCallback(frame) }
  video.requestVideoFrameCallback(frame)
}
function connect() {
  peer = createCameraPeer({ role, sessionId: 'probe-camera', createPeer: () => { rtc = new RTCPeerConnection({ iceServers: [] }); return rtc }, sendSignal: signal => adapter.send('camera:signal', signal),
    onStream: stream => { received++; attach(stream) }, onStateChange: state => { document.body.dataset.connection = state } })
}
connect()
const unsubscribe = adapter.on('camera:signal', signal => { void peer.acceptSignal(signal).catch(e => errors.push(e.message)) })
window.probe = {
  async start() {
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
    permissionStream.getTracks().forEach(track => track.stop())
    const devices = await navigator.mediaDevices.enumerateDevices()
    const device = devices.find(d => d.kind === 'videoinput')
    if (!device) throw new Error('No camera input available')
    const stream = await session.selectSource(device.deviceId)
    sourceTrack = stream.getVideoTracks()[0]
    attach(stream)
    await peer.start(stream)
    return { label: device.label, settings: sourceTrack.getSettings() }
  },
  async stats() {
    const values = []
    for (const stat of (await rtc.getStats()).values()) {
      if (['inbound-rtp', 'outbound-rtp'].includes(stat.type)) values.push({ type: stat.type, width: stat.frameWidth,
        height: stat.frameHeight, fps: stat.framesPerSecond, limitation: stat.qualityLimitationReason })
    }
    return values
  },
  snapshot() { return { received, frames, width: video.videoWidth, height: video.videoHeight, errors, connection: document.body.dataset.connection } },
  stop() { peer.dispose(); session.dispose(); unsubscribe(); adapter.dispose(); video.srcObject = null; return sourceTrack?.readyState }
}
`
const bundle = await build({
  stdin: { contents: source, resolveDir: root, loader: 'ts' },
  bundle: true,
  write: false,
  format: 'esm',
  alias: { '@shared': resolve(root, 'src/shared'), '@renderer': resolve(root, 'src/renderer/src') }
})
const html =
  '<!doctype html><title>Camera transport probe</title><video autoplay muted playsinline style="width:640px"></video><script type="module" src="/probe.js"></script>'
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/probe.js' ? 'text/javascript' : 'text/html')
  res.end(req.url === '/probe.js' ? bundle.outputFiles[0].text : html)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
let browser
let temporary
try {
  let sender
  let receiver
  if (desktop) {
    temporary = await mkdtemp(resolve(tmpdir(), 'hhc-camera-probe-'))
    const relay = await build({
      stdin: {
        contents:
          "export { registerProjectionHandlers } from './src/main/ipc/projection'; export { registerMediaPermissions } from './src/main/media-permissions'",
        resolveDir: root,
        loader: 'ts'
      },
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      external: ['electron'],
      alias: { '@shared': resolve(root, 'src/shared') }
    })
    await writeFile(resolve(temporary, 'relay.cjs'), relay.outputFiles[0].text)
    await writeFile(
      resolve(temporary, 'preload.cjs'),
      `
      const { contextBridge, ipcRenderer } = require('electron')
      contextBridge.exposeInMainWorld('api', { projection: {
        send: (...args) => ipcRenderer.send('projection:send', ...args),
        sendToMain: (...args) => ipcRenderer.send('projection:send-to-main', ...args),
        onProjectionMessage: handler => {
          const listener = (_event, ...args) => handler(...args)
          ipcRenderer.on('projection:message', listener)
          return () => ipcRenderer.removeListener('projection:message', listener)
        }
      } })`
    )
    await writeFile(
      resolve(temporary, 'main.js'),
      `
      const { app, BrowserWindow, session } = require('electron')
      const windows = []
      process.on('unhandledRejection', error => { global.probeError = String(error?.stack ?? error) })
      process.on('uncaughtException', error => { global.probeError = String(error?.stack ?? error) })
      process.on('uncaughtException', error => { global.probeError = String(error?.stack ?? error) })
      const { registerProjectionHandlers, registerMediaPermissions } = require('./relay.cjs')
      app.setPath('userData', ${JSON.stringify(resolve(temporary, 'profile'))})
      ${synthetic ? "app.commandLine.appendSwitch('use-fake-device-for-media-stream')" : ''}
      app.whenReady().then(async () => {
        const main = new BrowserWindow({ width: 700, height: 450, webPreferences: { preload: require('path').join(__dirname, 'preload.cjs') } })
        const projection = new BrowserWindow({ width: 700, height: 450, webPreferences: { preload: require('path').join(__dirname, 'preload.cjs') } })
        windows.push(main, projection)
        await Promise.all([main.loadURL(${JSON.stringify(base + '/?role=main')}), projection.loadURL(${JSON.stringify(base + '/?role=projection')})])
        registerMediaPermissions(session.defaultSession, () => main.webContents)
        registerProjectionHandlers({ getMainWindow: () => main, getProjectionWindow: () => projection,
          getProjectionState: () => ({ exists: true, lifecycle: { generation: 1 } }),
          isCurrentProjectionSender: (contents, generation) => contents === projection.webContents && generation === 1,
          sendToProjection: (...args) => projection.webContents.send(...args),
          sendToMain: (...args) => main.webContents.send(...args)
        })
      })
      app.on('window-all-closed', () => app.quit())`
    )
    browser = await electron.launch({ args: [resolve(temporary, 'main.js')] })
    browser.process().stderr?.on('data', (data) => process.stderr.write(data))
    await browser.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (global.probeError) throw new Error(global.probeError)
    })
    await browser.firstWindow()
    while (browser.windows().length < 2) await browser.waitForEvent('window')
    await Promise.all(browser.windows().map((page) => page.waitForURL(base + '/**')))
    sender = browser.windows().find((page) => page.url().endsWith('?role=main'))
    receiver = browser.windows().find((page) => page.url().endsWith('?role=projection'))
    assert.ok(sender && receiver, 'Both role-specific Electron windows must be loaded')
  } else {
    browser = await chromium.launch({
      channel: 'chromium',
      headless: synthetic,
      args: synthetic
        ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
        : []
    })
    const context = await browser.newContext({ permissions: ['camera'] })
    sender = await context.newPage()
    receiver = await context.newPage()
  }
  await Promise.all([sender.goto(`${base}/?role=main`), receiver.goto(`${base}/?role=projection`)])
  await Promise.all([
    sender.waitForFunction(() => window.probe),
    receiver.waitForFunction(() => window.probe)
  ])
  const sourceInfo = await sender.evaluate(() =>
    Promise.race([
      window.probe.start(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Camera acquisition did not complete within 20 seconds')),
          20000
        )
      )
    ])
  )
  // Source IDs are local identifiers and are deliberately omitted from the report.
  delete sourceInfo.settings.deviceId
  delete sourceInfo.settings.groupId
  await receiver.waitForFunction(() => window.probe.snapshot().frames >= 120, null, {
    timeout: 30000
  })
  const result = await receiver.evaluate(() => window.probe.snapshot())
  assert.equal(result.received, 1)
  assert.ok(result.width > 0 && result.height > 0)
  assert.deepEqual(result.errors, [])
  const senderResult = await sender.evaluate(() => window.probe.snapshot())
  assert.deepEqual(senderResult.errors, [])
  const statistics = await Promise.all([
    sender.evaluate(() => window.probe.stats()),
    receiver.evaluate(() => window.probe.stats())
  ])
  assert.equal(await sender.evaluate(() => window.probe.stop()), 'ended')
  await receiver.evaluate(() => window.probe.stop())
  console.log(
    JSON.stringify(
      {
        mode: synthetic ? 'synthetic' : 'physical',
        transport: desktop ? 'electron-ipc' : 'broadcast-channel',
        source: sourceInfo,
        receiver: result,
        captureStopped: true,
        statistics
      },
      null,
      2
    )
  )
} finally {
  await browser?.close()
  if (temporary) await rm(temporary, { recursive: true, force: true })
  await new Promise((resolve) => server.close(resolve))
}
