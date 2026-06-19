/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { access, cp } from 'node:fs/promises'
import { join } from 'node:path'

const strict = process.argv.includes('--strict')
const strictAll = process.argv.includes('--all')
const root = process.cwd()

const targets = [
  {
    name: 'VLC macOS arm64',
    platform: 'darwin',
    arch: 'arm64',
    source: '.local-runtimes/vlc/darwin-arm64',
    dest: 'resources/video-engine/vlc/darwin-arm64',
    required: ['libvlc.dylib', 'libvlc.5.dylib']
  },
  {
    name: 'VLC macOS x64',
    platform: 'darwin',
    arch: 'x64',
    source: '.local-runtimes/vlc/darwin-x64',
    dest: 'resources/video-engine/vlc/darwin-x64',
    required: ['libvlc.dylib', 'libvlc.5.dylib']
  },
  {
    name: 'VLC Windows x64',
    platform: 'win32',
    arch: 'x64',
    source: '.local-runtimes/vlc/win32-x64',
    dest: 'resources/video-engine/vlc/win32-x64',
    required: ['libvlc.dll']
  },
  {
    name: 'FFmpeg macOS arm64',
    platform: 'darwin',
    arch: 'arm64',
    source: '.local-runtimes/ffmpeg/darwin-arm64',
    dest: 'resources/video-engine/ffmpeg/darwin-arm64',
    required: ['ffmpeg']
  },
  {
    name: 'FFmpeg macOS x64',
    platform: 'darwin',
    arch: 'x64',
    source: '.local-runtimes/ffmpeg/darwin-x64',
    dest: 'resources/video-engine/ffmpeg/darwin-x64',
    required: ['ffmpeg']
  },
  {
    name: 'FFmpeg Windows x64',
    platform: 'win32',
    arch: 'x64',
    source: '.local-runtimes/ffmpeg/win32-x64',
    dest: 'resources/video-engine/ffmpeg/win32-x64',
    required: ['ffmpeg.exe']
  }
]

/** @returns {Promise<boolean>} */
async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function isStrictTarget(target) {
  return strictAll || (target.platform === process.platform && target.arch === process.arch)
}

let missing = 0

for (const target of targets) {
  const source = join(root, target.source)
  const dest = join(root, target.dest)
  if (!(await exists(source))) {
    console.warn(`missing source: ${target.source}`)
    if (isStrictTarget(target)) missing++
    continue
  }

  await cp(source, dest, { recursive: true, force: true })

  const hasRequired = await Promise.any(
    target.required.map((file) =>
      exists(join(dest, file)).then((ok) => (ok ? file : Promise.reject()))
    )
  ).catch(() => null)

  if (hasRequired) {
    console.log(`ready: ${target.name}`)
  } else {
    console.warn(`missing runtime file after copy: ${target.name}`)
    if (isStrictTarget(target)) missing++
  }
}

if (strict && missing > 0) {
  process.exitCode = 1
}
