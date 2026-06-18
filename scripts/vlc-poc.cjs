/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow } = require('electron')
const { VlcPlayer, probeDefaultVlcDir } = require('electron-vlc-player')

const mediaPath = process.argv[2]
const vlcDir = process.argv[3] || probeDefaultVlcDir()

if (!mediaPath) {
  console.error('Usage: npm run poc:vlc -- /absolute/path/to/video [vlcDir]')
  process.exit(1)
}

if (!vlcDir) {
  console.error('VLC runtime not found. Install VLC.app or pass vlcDir explicitly.')
  process.exit(1)
}

let player = null

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#000000'
  })

  await win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
<!doctype html>
<html>
  <head>
    <style>
      html, body, #player {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #000;
      }
    </style>
  </head>
  <body>
    <div id="player"></div>
  </body>
</html>
`)}`
  )

  player = new VlcPlayer({
    window: win,
    container: '#player',
    vlcDir,
    controls: false
  })

  await player.embed()
  player.setSource(mediaPath)

  win.on('closed', () => {
    player?.destroy()
    player = null
    app.quit()
  })
})

app.on('before-quit', () => {
  player?.destroy()
})
