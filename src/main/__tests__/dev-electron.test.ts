import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('macOS development Electron bundle', () => {
  it('runs development through the bundle launcher', async () => {
    const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: { dev: string }
    }

    expect(pkg.scripts.dev).toBe('node scripts/dev.mjs')
  })

  it('uses the HHC Presenter development identity and production callback scheme', async () => {
    const { patchDevInfoPlist } = await import('../../../scripts/dev.mjs')
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Electron</string>
  <key>CFBundleIdentifier</key>
  <string>com.github.Electron</string>
  <key>CFBundleName</key>
  <string>Electron</string>
</dict>
</plist>`

    const result = patchDevInfoPlist(source)

    expect(result).toContain('<string>HHC Presenter Dev</string>')
    expect(result).toContain('<string>tw.org.alive.presenter.dev</string>')
    expect(result).toContain('<string>hhc-presenter</string>')
    expect(result).not.toContain('<string>com.github.Electron</string>')
  })

  it('points electron-vite at the development bundle executable', async () => {
    const { createDevEnvironment } = await import('../../../scripts/dev.mjs')

    expect(createDevEnvironment('/tmp/dev-electron', { PATH: '/bin' })).toEqual({
      PATH: '/bin',
      ELECTRON_EXEC_PATH: '/tmp/dev-electron/Electron.app/Contents/MacOS/Electron'
    })
  })

  it.runIf(process.platform === 'darwin')('prepares a runnable development bundle', async () => {
    const { prepareMacDevElectron } = await import('../../../scripts/dev.mjs')
    const root = await mkdtemp(join(tmpdir(), 'hhc-presenter-dev-electron-'))
    tempRoots.push(root)
    const source = join(root, 'source')
    const target = join(root, 'target')
    const contents = join(source, 'Electron.app/Contents')
    await mkdir(join(contents, 'MacOS'), { recursive: true })
    await mkdir(join(contents, 'Frameworks/Demo.framework/Versions/A'), { recursive: true })
    await copyFile('/bin/echo', join(contents, 'MacOS/Electron'))
    await symlink('A', join(contents, 'Frameworks/Demo.framework/Versions/Current'))
    await writeFile(
      join(contents, 'Info.plist'),
      `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>Electron</string>
  <key>CFBundleExecutable</key><string>Electron</string>
  <key>CFBundleIdentifier</key><string>com.github.Electron</string>
  <key>CFBundleName</key><string>Electron</string>
</dict>
</plist>`
    )

    await prepareMacDevElectron(source, target)

    const plist = await readFile(join(target, 'Electron.app/Contents/Info.plist'), 'utf8')
    expect(plist).toContain('<string>tw.org.alive.presenter.dev</string>')
    expect(plist).toContain('<string>hhc-presenter</string>')
    await expect(readFile(join(target, 'Electron.app/Contents/MacOS/Electron'))).resolves.toEqual(
      await readFile('/bin/echo')
    )
    await expect(
      readlink(join(target, 'Electron.app/Contents/Frameworks/Demo.framework/Versions/Current'))
    ).resolves.toBe('A')
  })
})
