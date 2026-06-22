import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises'
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
})
