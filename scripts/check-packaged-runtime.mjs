/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { access, readFile, readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'

const args = new Set(process.argv.slice(2))
const root = process.cwd()
const distDir = process.env.PACKAGE_DIST_DIR ?? join(root, 'dist')
const currentTarget = `${process.platform}-${process.arch}`
const targetArg = process.argv.find((arg) => arg.startsWith('--target='))
const requestedTarget = targetArg ? targetArg.slice('--target='.length) : currentTarget
const checkAll = args.has('--all')
const maxWindowsInstallerBytes = 450 * 1024 * 1024

const licenseFiles = [
  'licenses/vlc/LICENSE.GPL-2.0',
  'licenses/vlc/LICENSE.LGPL-2.1',
  'licenses/ffmpeg/LICENSE.LGPL-2.1',
  'licenses/electron-vlc-player/LICENSE.MIT'
]

const nativeBindingFile =
  'app.asar.unpacked/node_modules/electron-vlc-player/build/Release/vlc_binding.node'

const targetChecks = {
  'darwin-arm64': {
    vlcDir: 'video-engine/vlc/darwin-arm64',
    vlcFiles: ['libvlc.dylib', 'libvlc.5.dylib', 'lib/libvlc.dylib', 'lib/libvlc.5.dylib'],
    ffmpegDir: 'video-engine/ffmpeg/darwin-arm64',
    ffmpegFiles: ['ffmpeg']
  },
  'darwin-x64': {
    vlcDir: 'video-engine/vlc/darwin-x64',
    vlcFiles: ['libvlc.dylib', 'libvlc.5.dylib', 'lib/libvlc.dylib', 'lib/libvlc.5.dylib'],
    ffmpegDir: 'video-engine/ffmpeg/darwin-x64',
    ffmpegFiles: ['ffmpeg']
  },
  'win32-x64': {
    vlcDir: 'video-engine/vlc/win32-x64',
    vlcFiles: ['libvlc.dll'],
    ffmpegDir: 'video-engine/ffmpeg/win32-x64',
    ffmpegFiles: ['ffmpeg.exe']
  }
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function listDirectories(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(path, entry.name))
  } catch {
    return []
  }
}

function toPosix(path) {
  return path.split('\\').join('/')
}

function isMacResourceRoot(path) {
  const normalized = toPosix(path)
  return normalized.endsWith('.app/Contents/Resources')
}

function isWinResourceRoot(path) {
  const normalized = toPosix(path)
  return /\/win(?:32|-x64)?-unpacked\/resources$/.test(normalized)
}

function resourceRootTarget(path) {
  const normalized = toPosix(path)
  if (normalized.includes('/mac-arm64/')) return 'darwin-arm64'
  if (normalized.includes('/mac-x64/') || normalized.includes('/mac/')) return 'darwin-x64'
  if (normalized.includes('/win-unpacked/') || normalized.includes('/win-x64-unpacked/')) {
    return 'win32-x64'
  }
  return null
}

async function findResourceRoots(dir) {
  const roots = []
  const pending = [dir]

  while (pending.length > 0) {
    const next = pending.pop()
    if (!next) continue

    if (isMacResourceRoot(next) || isWinResourceRoot(next)) {
      roots.push(next)
      continue
    }

    const depth = toPosix(next).replace(toPosix(dir), '').split('/').filter(Boolean).length
    if (depth >= 6) continue
    pending.push(...(await listDirectories(next)))
  }

  return roots
}

async function hasAnyFile(dir, files) {
  for (const file of files) {
    if (await exists(join(dir, file))) return true
  }
  return false
}

async function checkResourceRoot(resourceRoot, target) {
  const failures = []
  const checks = targetChecks[target]
  const normalizedRoot = toPosix(resourceRoot)

  if (!checks) {
    failures.push(`Unsupported package target: ${target}`)
    return failures
  }

  if (
    target.startsWith('darwin-') &&
    !normalizedRoot.endsWith('/HHC Presenter.app/Contents/Resources')
  ) {
    failures.push('macOS bundle must be named HHC Presenter.app')
  }

  if (target === 'win32-x64' && !(await exists(join(resourceRoot, '..', 'hhc-presenter.exe')))) {
    failures.push('Windows executable must be named hhc-presenter.exe')
  }

  const updaterConfigPath = join(resourceRoot, 'app-update.yml')
  if (!(await exists(updaterConfigPath))) {
    failures.push('Missing app-update.yml')
  } else {
    const updaterConfig = await readFile(updaterConfigPath, 'utf8')
    for (const expected of [
      /^owner:\s*rayselfs\s*$/m,
      /^repo:\s*hhc-presenter\s*$/m,
      /^provider:\s*github\s*$/m,
      /^updaterCacheDirName:\s*hhc-presenter-updater\s*$/m
    ]) {
      if (!expected.test(updaterConfig)) failures.push(`Invalid updater metadata: ${expected}`)
    }
  }

  if (target.startsWith('darwin-')) {
    const infoPlist = await readFile(join(resourceRoot, '..', 'Info.plist'), 'utf8')
    if (!infoPlist.includes('<string>tw.org.alive.presenter</string>')) {
      failures.push('macOS bundle identifier must be tw.org.alive.presenter')
    }
    if (!infoPlist.includes('<string>hhc-presenter</string>')) {
      failures.push('macOS URL scheme must be hhc-presenter')
    }
  }

  for (const file of licenseFiles) {
    if (!(await exists(join(resourceRoot, file)))) {
      failures.push(`Missing license notice: ${file}`)
    }
  }

  if (!(await exists(join(resourceRoot, nativeBindingFile)))) {
    failures.push(`Missing electron-vlc-player native binding: ${nativeBindingFile}`)
  }

  const duplicateRuntime = 'app.asar.unpacked/resources/video-engine'
  if (await exists(join(resourceRoot, duplicateRuntime))) {
    failures.push(`Duplicate video engine runtime: ${duplicateRuntime}`)
  }

  const appAsar = join(resourceRoot, 'app.asar')
  if (await exists(appAsar)) {
    const packagedFiles = listPackage(appAsar)
    const mainSource = extractFile(appAsar, 'out/main/index.js').toString('utf8')
    if (!mainSource.includes('tw.org.alive.presenter')) {
      failures.push('Packaged main process must use the HHC Presenter AUMID')
    }
    if (!mainSource.includes('hhc-presenter')) {
      failures.push('Packaged main process must use the hhc-presenter protocol')
    }
    if (packagedFiles.some((file) => file.startsWith('/.local-runtimes/'))) {
      failures.push('Local runtime downloads must not be embedded in app.asar')
    }
    const pdfWorkers = packagedFiles.filter((file) =>
      /^\/out\/renderer\/assets\/pdf-worker[^/]*\.js$/.test(file)
    )
    if (pdfWorkers.length === 0) {
      failures.push('Missing compiled PDF worker in app.asar')
    } else if (
      pdfWorkers.some((file) => {
        const source = extractFile(appAsar, file.slice(1)).toString('utf8')
        return /\b(?:interface|type)\s+\w+|<K,\s*V>|:\s*(?:Map|Iterable)<|import\('pdfjs-dist/.test(
          source
        )
      })
    ) {
      failures.push('PDF worker contains uncompiled TypeScript source')
    }
  }

  if (!(await hasAnyFile(join(resourceRoot, checks.vlcDir), checks.vlcFiles))) {
    failures.push(`Missing bundled VLC runtime in ${checks.vlcDir}`)
  }

  if (!(await hasAnyFile(join(resourceRoot, checks.ffmpegDir), checks.ffmpegFiles))) {
    failures.push(`Missing bundled FFmpeg poster runtime in ${checks.ffmpegDir}`)
  }

  if (target === 'win32-x64') {
    const artifacts = await readdir(distDir, { withFileTypes: true })
    for (const artifact of artifacts) {
      if (!artifact.isFile() || !artifact.name.endsWith('-setup.exe')) continue
      const { size } = await stat(join(distDir, artifact.name))
      if (size > maxWindowsInstallerBytes) {
        failures.push(
          `Windows installer exceeds 450 MiB: ${artifact.name} (${(size / 1024 / 1024).toFixed(1)} MiB)`
        )
      }
    }
  }

  return failures
}

async function main() {
  try {
    await stat(distDir)
  } catch {
    console.error(`Package dist directory not found: ${distDir}`)
    process.exitCode = 1
    return
  }

  const roots = await findResourceRoots(distDir)
  const rootsToCheck = checkAll
    ? roots
    : roots.filter((resourceRoot) => resourceRootTarget(resourceRoot) === requestedTarget)

  if (rootsToCheck.length === 0) {
    console.error(
      `No packaged app resources found for ${checkAll ? 'any target' : requestedTarget}`
    )
    process.exitCode = 1
    return
  }

  let failureCount = 0
  for (const resourceRoot of rootsToCheck) {
    const target = resourceRootTarget(resourceRoot)
    if (!target) {
      console.warn(`Skipping unknown package layout: ${resourceRoot}`)
      continue
    }

    const failures = await checkResourceRoot(resourceRoot, target)
    if (failures.length === 0) {
      console.log(`ready: ${basename(resourceRoot)} (${target})`)
      continue
    }

    failureCount += failures.length
    console.error(`Invalid packaged runtime resources: ${resourceRoot}`)
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
  }

  if (failureCount > 0) {
    process.exitCode = 1
  }
}

await main()
