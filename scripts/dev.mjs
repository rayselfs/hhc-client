/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cp, mkdir, readFile, readlink, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEV_NAME = 'HHC Presenter Dev'
const DEV_APP_ID = 'tw.org.alive.presenter.dev'
const PROTOCOL = 'hhc-presenter'
const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

function replacePlistString(plist, key, value) {
  const pattern = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`)
  if (!pattern.test(plist)) throw new Error(`Electron Info.plist is missing ${key}`)
  return plist.replace(pattern, `$1${value}$2`)
}

export function patchDevInfoPlist(source) {
  let plist = replacePlistString(source, 'CFBundleDisplayName', DEV_NAME)
  plist = replacePlistString(plist, 'CFBundleIdentifier', DEV_APP_ID)
  plist = replacePlistString(plist, 'CFBundleName', DEV_NAME)

  const rootEnd = plist.lastIndexOf('</dict>')
  if (rootEnd < 0) throw new Error('Electron Info.plist has no root dictionary')
  const protocol = `  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
      <key>CFBundleURLName</key>
      <string>${DEV_NAME}</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>${PROTOCOL}</string>
      </array>
    </dict>
  </array>
`
  return `${plist.slice(0, rootEnd)}${protocol}${plist.slice(rootEnd)}`
}

async function isPrepared(targetDist) {
  try {
    const plist = await readFile(join(targetDist, 'Electron.app/Contents/Info.plist'), 'utf8')
    const frameworkResources = await readlink(
      join(targetDist, 'Electron.app/Contents/Frameworks/Electron Framework.framework/Resources')
    )
    return (
      plist.includes(DEV_APP_ID) &&
      plist.includes(`<string>${PROTOCOL}</string>`) &&
      !isAbsolute(frameworkResources)
    )
  } catch {
    return false
  }
}

export async function prepareMacDevElectron(sourceDist, targetDist) {
  if (await isPrepared(targetDist)) return targetDist

  const temporaryDist = `${targetDist}.${process.pid}.tmp`
  const plistPath = join(temporaryDist, 'Electron.app/Contents/Info.plist')
  await rm(temporaryDist, { recursive: true, force: true })
  await mkdir(dirname(targetDist), { recursive: true })
  try {
    await cp(sourceDist, temporaryDist, { recursive: true, verbatimSymlinks: true })
    await writeFile(plistPath, patchDevInfoPlist(await readFile(plistPath, 'utf8')))
    await rm(targetDist, { recursive: true, force: true })
    await rename(temporaryDist, targetDist)
    return targetDist
  } catch (error) {
    await rm(temporaryDist, { recursive: true, force: true })
    throw error
  }
}

export function createDevEnvironment(targetDist, baseEnv = process.env) {
  return {
    ...baseEnv,
    ELECTRON_EXEC_PATH: join(targetDist, 'Electron.app/Contents/MacOS/Electron')
  }
}

async function runDev() {
  const require = createRequire(import.meta.url)
  const electronDir = dirname(require.resolve('electron'))
  const electronPackage = JSON.parse(await readFile(join(electronDir, 'package.json'), 'utf8'))
  const electronViteDir = dirname(require.resolve('electron-vite/package.json'))
  const env = { ...process.env }
  let devAppPath

  if (process.platform === 'darwin') {
    const targetDist = resolve(
      process.cwd(),
      '.local-runtimes/electron-dev',
      electronPackage.version
    )
    await prepareMacDevElectron(join(electronDir, 'dist'), targetDist)
    Object.assign(env, createDevEnvironment(targetDist, env))
    devAppPath = join(targetDist, 'Electron.app')
  }

  const child = spawn(
    process.execPath,
    [join(electronViteDir, 'bin/electron-vite.js'), 'dev', ...process.argv.slice(2)],
    { env, stdio: 'inherit' }
  )
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
    process.once(signal, () => child.kill(signal))
  }
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolveExit(code ?? 1))
  })
  if (devAppPath) spawnSync(LSREGISTER, ['-u', devAppPath])
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runDev()
}
