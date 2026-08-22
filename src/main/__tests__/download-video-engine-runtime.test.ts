import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile, access, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const scriptPath = resolve(process.cwd(), 'scripts/download-video-engine-runtime.mjs')
const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'download-runtime-'))
  tempRoots.push(root)
  return root
}

async function writeFileIn(root: string, path: string): Promise<void> {
  const absolutePath = join(root, path)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, '')
}

async function createArchive(root: string): Promise<{ url: string; sha256: string }> {
  const source = join(root, 'source')
  const archive = join(root, 'runtime.tar')
  await writeFileIn(source, 'runtime/libvlc.dylib')

  await execFileAsync('tar', ['-cf', archive, '-C', source, '.'])

  const data = await readFile(archive)
  const sha256 = createHash('sha256').update(data).digest('hex')
  return {
    url: `data:application/x-tar;base64,${data.toString('base64')}`,
    sha256
  }
}

async function runDownloader(root: string, url: string, sha256: string): Promise<void> {
  await execFileAsync(
    process.execPath,
    [
      scriptPath,
      '--component=vlc',
      '--platform=darwin',
      '--arch=arm64',
      `--url=${url}`,
      `--sha256=${sha256}`
    ],
    { cwd: root }
  )
}

async function runWindowsDownloader(root: string): Promise<void> {
  const bin = join(root, 'bin')
  const pwsh = join(bin, 'pwsh')
  await mkdir(bin)
  await writeFile(
    pwsh,
    `#!/usr/bin/env node
const { spawnSync } = require('node:child_process')
require('node:fs').writeFileSync('pwsh-invoked', '')
const archive = process.env.RUNTIME_ARCHIVE_PATH
const destination = process.env.RUNTIME_EXTRACT_ROOT
process.exit(spawnSync('tar', ['-xf', archive, '-C', destination]).status ?? 1)
`
  )
  await chmod(pwsh, 0o755)

  await writeFileIn(join(root, 'source'), 'runtime/libvlc.dll')
  const archivePath = join(root, 'runtime.zip')
  await execFileAsync('tar', ['-cf', archivePath, '-C', join(root, 'source'), '.'])
  const data = await readFile(archivePath)
  const windowsUrl = `data:application/zip;base64,${data.toString('base64')}`
  const windowsSha256 = createHash('sha256').update(data).digest('hex')

  await execFileAsync(
    process.execPath,
    [
      scriptPath,
      '--component=vlc',
      '--platform=win32',
      '--arch=x64',
      `--url=${windowsUrl}`,
      `--sha256=${windowsSha256}`
    ],
    { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }
  )
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('download video engine runtime script', () => {
  it('downloads, verifies, and extracts runtime archives', async () => {
    const root = await createTempRoot()
    const archive = await createArchive(root)

    await expect(runDownloader(root, archive.url, archive.sha256)).resolves.toBeUndefined()
    await expect(
      access(join(root, '.local-runtimes/vlc/darwin-arm64/libvlc.dylib'))
    ).resolves.toBeUndefined()
  })

  it('rejects runtime archives with an invalid checksum', async () => {
    const root = await createTempRoot()
    const archive = await createArchive(root)

    await expect(runDownloader(root, archive.url, '0'.repeat(64))).rejects.toMatchObject({
      code: 1
    })
  })

  it('uses PowerShell archive extraction for Windows zip runtimes', async () => {
    const root = await createTempRoot()

    await expect(runWindowsDownloader(root)).resolves.toBeUndefined()
    await expect(
      access(join(root, '.local-runtimes/vlc/win32-x64/libvlc.dll'))
    ).resolves.toBeUndefined()
    await expect(access(join(root, 'pwsh-invoked'))).resolves.toBeUndefined()
  })
})
