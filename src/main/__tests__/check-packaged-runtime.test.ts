import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const scriptPath = resolve(process.cwd(), 'scripts/check-packaged-runtime.mjs')
const tempRoots: string[] = []

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'packaged-runtime-'))
  tempRoots.push(root)
  return root
}

async function writeFileIn(root: string, path: string): Promise<void> {
  const absolutePath = join(root, path)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, '')
}

async function writeValidMacPackage(root: string): Promise<string> {
  const resourcesRoot = join(root, 'dist/mac-arm64/LibrePresenter.app/Contents/Resources')
  await writeFileIn(resourcesRoot, 'licenses/vlc/LICENSE.GPL-2.0')
  await writeFileIn(resourcesRoot, 'licenses/vlc/LICENSE.LGPL-2.1')
  await writeFileIn(resourcesRoot, 'licenses/ffmpeg/LICENSE.LGPL-2.1')
  await writeFileIn(resourcesRoot, 'licenses/electron-vlc-player/LICENSE.MIT')
  await writeFileIn(
    resourcesRoot,
    'app.asar.unpacked/node_modules/electron-vlc-player/build/Release/vlc_binding.node'
  )
  await writeFileIn(resourcesRoot, 'video-engine/vlc/darwin-arm64/libvlc.dylib')
  await writeFileIn(resourcesRoot, 'video-engine/ffmpeg/darwin-arm64/ffmpeg')
  return resourcesRoot
}

async function runChecker(root: string): Promise<void> {
  await execFileAsync(process.execPath, [scriptPath, '--target=darwin-arm64'], {
    cwd: root,
    env: {
      ...process.env,
      PACKAGE_DIST_DIR: join(root, 'dist')
    }
  })
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('check packaged runtime script', () => {
  it('accepts packaged apps with runtime binaries and license notices', async () => {
    const root = await createTempRoot()
    await writeValidMacPackage(root)

    await expect(runChecker(root)).resolves.toBeUndefined()
  })

  it('rejects packaged apps missing runtime binaries', async () => {
    const root = await createTempRoot()
    const resourcesRoot = await writeValidMacPackage(root)
    await rm(join(resourcesRoot, 'video-engine/vlc/darwin-arm64/libvlc.dylib'))

    await expect(runChecker(root)).rejects.toMatchObject({ code: 1 })
  })

  it('rejects packaged apps missing the electron-vlc-player binding', async () => {
    const root = await createTempRoot()
    const resourcesRoot = await writeValidMacPackage(root)
    await rm(
      join(
        resourcesRoot,
        'app.asar.unpacked/node_modules/electron-vlc-player/build/Release/vlc_binding.node'
      )
    )

    await expect(runChecker(root)).rejects.toMatchObject({ code: 1 })
  })

  it('rejects packaged apps missing license notices', async () => {
    const root = await createTempRoot()
    const resourcesRoot = await writeValidMacPackage(root)
    await rm(join(resourcesRoot, 'licenses/ffmpeg/LICENSE.LGPL-2.1'))

    await expect(runChecker(root)).rejects.toMatchObject({ code: 1 })
  })
})
