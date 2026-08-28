import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { createPackage } from '@electron/asar'
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

async function writeRendererAsar(
  resourcesRoot: string,
  workerSource = 'self.onmessage = () => {}'
): Promise<void> {
  const asarSource = join(resourcesRoot, 'asar-source')
  await writeFileIn(asarSource, 'out/renderer/assets/pdf-worker.js')
  await writeFile(join(asarSource, 'out/renderer/assets/pdf-worker.js'), workerSource)
  await createPackage(asarSource, join(resourcesRoot, 'app.asar'))
  await rm(asarSource, { recursive: true })
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
  await writeFileIn(resourcesRoot, 'video-engine/vlc/darwin-arm64/lib/libvlc.dylib')
  await writeFileIn(resourcesRoot, 'video-engine/ffmpeg/darwin-arm64/ffmpeg')
  await writeRendererAsar(resourcesRoot)
  return resourcesRoot
}

async function writeValidWindowsPackage(root: string): Promise<string> {
  const resourcesRoot = join(root, 'dist/win-unpacked/resources')
  await writeFileIn(resourcesRoot, 'licenses/vlc/LICENSE.GPL-2.0')
  await writeFileIn(resourcesRoot, 'licenses/vlc/LICENSE.LGPL-2.1')
  await writeFileIn(resourcesRoot, 'licenses/ffmpeg/LICENSE.LGPL-2.1')
  await writeFileIn(resourcesRoot, 'licenses/electron-vlc-player/LICENSE.MIT')
  await writeFileIn(
    resourcesRoot,
    'app.asar.unpacked/node_modules/electron-vlc-player/build/Release/vlc_binding.node'
  )
  await writeFileIn(resourcesRoot, 'video-engine/vlc/win32-x64/libvlc.dll')
  await writeFileIn(resourcesRoot, 'video-engine/ffmpeg/win32-x64/ffmpeg.exe')
  await writeRendererAsar(resourcesRoot)
  return resourcesRoot
}

async function runChecker(root: string, target = 'darwin-arm64'): Promise<void> {
  await execFileAsync(process.execPath, [scriptPath, `--target=${target}`], {
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
    await rm(join(resourcesRoot, 'video-engine/vlc/darwin-arm64/lib/libvlc.dylib'))

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

  it('rejects a duplicate video engine runtime outside extraResources', async () => {
    const root = await createTempRoot()
    const resourcesRoot = await writeValidWindowsPackage(root)
    await writeFileIn(
      resourcesRoot,
      'app.asar.unpacked/resources/video-engine/vlc/win32-x64/libvlc.dll'
    )

    await expect(runChecker(root, 'win32-x64')).rejects.toMatchObject({ code: 1 })
  })

  it('rejects local runtime downloads embedded in app.asar', async () => {
    const root = await createTempRoot()
    const resourcesRoot = await writeValidWindowsPackage(root)
    const asarSource = join(root, 'asar-source')
    await writeFileIn(asarSource, '.local-runtimes/vlc/win32-x64/libvlc.dll')
    await createPackage(asarSource, join(resourcesRoot, 'app.asar'))

    await expect(runChecker(root, 'win32-x64')).rejects.toMatchObject({ code: 1 })
  })

  it('rejects a PDF worker packaged as raw TypeScript', async () => {
    const root = await createTempRoot()
    const resourcesRoot = await writeValidMacPackage(root)
    await writeRendererAsar(
      resourcesRoot,
      'value<K, V>(this: Map<K, V>, key: K): V { return this.get(key)! }'
    )

    await expect(runChecker(root)).rejects.toMatchObject({ code: 1 })
  })

  it('rejects Windows installers larger than 450 MiB', async () => {
    const root = await createTempRoot()
    await writeValidWindowsPackage(root)
    const installer = join(root, 'dist/libre-presenter-2.2.3-setup.exe')
    await writeFile(installer, '')
    await truncate(installer, 451 * 1024 * 1024)

    await expect(runChecker(root, 'win32-x64')).rejects.toMatchObject({ code: 1 })
  })
})
