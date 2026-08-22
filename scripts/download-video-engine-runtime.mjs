/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { access, cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'

const root = process.cwd()

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg?.slice(prefix.length)
}

const component = argValue('component')
const platform = argValue('platform') ?? process.platform
const arch = argValue('arch') ?? process.arch
const url = argValue('url')
const sha256 = argValue('sha256')?.toLowerCase()

const requiredFiles = {
  vlc: platform === 'win32' ? ['libvlc.dll'] : ['libvlc.dylib', 'libvlc.5.dylib'],
  ffmpeg: platform === 'win32' ? ['ffmpeg.exe'] : ['ffmpeg']
}

function assertValidInput() {
  if (component !== 'vlc' && component !== 'ffmpeg') {
    throw new Error('Expected --component=vlc or --component=ffmpeg')
  }
  if (!url) throw new Error('Missing --url')
  if (!sha256) throw new Error('Missing --sha256')
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid --sha256')
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function downloadArchive(archivePath) {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download runtime archive: ${response.status} ${response.statusText}`)
  }

  const hash = createHash('sha256')
  const digest = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk)
      callback(null, chunk)
    }
  })

  await mkdir(dirname(archivePath), { recursive: true })
  await pipeline(Readable.fromWeb(response.body), digest, createWriteStream(archivePath))

  const actual = hash.digest('hex')
  if (actual !== sha256) {
    throw new Error(`Runtime archive checksum mismatch: expected ${sha256}, got ${actual}`)
  }
}

function extractArchive(archivePath, extractRoot) {
  const cwd = dirname(archivePath)
  const result = spawnSync(
    'tar',
    ['-xf', basename(archivePath), '-C', relative(cwd, extractRoot)],
    {
      cwd,
      encoding: 'utf8'
    }
  )

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to extract runtime archive')
  }
}

async function findRuntimeRoot(searchRoot) {
  const pending = [searchRoot]
  const files = requiredFiles[component]

  while (pending.length > 0) {
    const next = pending.pop()
    if (!next) continue

    for (const file of files) {
      if (await exists(join(next, file))) return next
    }

    const entries = await import('node:fs/promises').then((fs) =>
      fs.readdir(next, { withFileTypes: true }).catch(() => [])
    )
    for (const entry of entries) {
      if (entry.isDirectory()) pending.push(join(next, entry.name))
    }
  }

  throw new Error(`Archive does not contain ${component} runtime files`)
}

async function main() {
  assertValidInput()

  const tempRoot = await mkdtemp(join(tmpdir(), 'video-engine-runtime-download-'))
  const archivePath = join(tempRoot, 'runtime-archive')
  const extractRoot = join(tempRoot, 'extract')
  const destination = resolve(root, '.local-runtimes', component, `${platform}-${arch}`)

  try {
    await mkdir(extractRoot, { recursive: true })
    await downloadArchive(archivePath)
    extractArchive(archivePath, extractRoot)

    const runtimeRoot = await findRuntimeRoot(extractRoot)
    await rm(destination, { recursive: true, force: true })
    await mkdir(dirname(destination), { recursive: true })
    await cp(runtimeRoot, destination, { recursive: true, force: true })
    console.log(`ready: ${component} ${platform}-${arch}`)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

await main()
