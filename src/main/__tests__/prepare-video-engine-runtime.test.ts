import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const scriptPath = resolve(process.cwd(), 'scripts/prepare-video-engine-runtime.mjs')
const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'video-engine-runtime-'))
  tempRoots.push(root)
  return root
}

async function writeRuntimeFile(root: string, path: string): Promise<void> {
  const absolutePath = join(root, path)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, '')
}

async function runPrepare(root: string, args: string[] = []): Promise<void> {
  await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    env: {
      ...process.env,
      VIDEO_ENGINE_RUNTIME_PLATFORM: 'darwin',
      VIDEO_ENGINE_RUNTIME_ARCH: 'arm64'
    }
  })
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('prepare video engine runtime script', () => {
  it('allows non-strict preparation without local runtime binaries', async () => {
    await expect(runPrepare(await createTempRoot())).resolves.toBeUndefined()
  })

  it('requires only the current platform runtime in strict mode', async () => {
    const root = await createTempRoot()
    await writeRuntimeFile(root, '.local-runtimes/vlc/darwin-arm64/lib/libvlc.dylib')
    await writeRuntimeFile(root, '.local-runtimes/ffmpeg/darwin-arm64/ffmpeg')

    await expect(runPrepare(root, ['--strict'])).resolves.toBeUndefined()
    await expect(
      access(join(root, 'resources/video-engine/vlc/darwin-arm64/lib/libvlc.dylib'))
    ).resolves.toBeUndefined()
    await expect(
      access(join(root, 'resources/video-engine/ffmpeg/darwin-arm64/ffmpeg'))
    ).resolves.toBeUndefined()
  })

  it('requires every runtime when strict all mode is requested', async () => {
    const root = await createTempRoot()
    await writeRuntimeFile(root, '.local-runtimes/vlc/darwin-arm64/libvlc.dylib')
    await writeRuntimeFile(root, '.local-runtimes/ffmpeg/darwin-arm64/ffmpeg')

    await expect(runPrepare(root, ['--strict', '--all'])).rejects.toMatchObject({ code: 1 })
  })
})
