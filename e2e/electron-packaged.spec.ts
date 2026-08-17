import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { execFile } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { completeOnboarding } from './helpers'

let electronApp: ElectronApplication | null = null
const execFileAsync = promisify(execFile)

function packagedFfmpegPath(executablePath: string): string {
  const platformDir = process.platform === 'win32' ? 'win32-x64' : `darwin-${process.arch}`
  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const resources =
    process.platform === 'darwin'
      ? join(dirname(executablePath), '..', 'Resources')
      : join(dirname(executablePath), 'resources')
  return resolve(resources, 'video-engine', 'ffmpeg', platformDir, executable)
}

test.afterEach(async () => {
  await electronApp?.close()
  electronApp = null
})

test('launches packaged control and projection windows with recovery lifecycle', async ({
  browserName: _browserName
}, testInfo) => {
  test.setTimeout(90_000)
  const configuredPath = process.env.PACKAGED_APP_PATH
  if (!configuredPath) throw new Error('PACKAGED_APP_PATH is required')
  const packagedAppPath = resolve(configuredPath)
  const userDataPath = testInfo.outputPath('user-data')

  await test.step('launch packaged app', async () => {
    electronApp = await electron.launch({
      executablePath: packagedAppPath,
      args: [`--user-data-dir=${userDataPath}`],
      timeout: 15_000
    })
  })

  const control = await test.step('open control window', async () => {
    const window = await electronApp!.firstWindow()
    await expect(window).toHaveTitle(/LibrePresenter/)
    await completeOnboarding(window)
    return window
  })

  await test.step('start timer and open projection window', async () => {
    await control.getByTestId('btn-start').click()
    await expect.poll(() => electronApp?.windows().length ?? 0).toBe(2)
  })

  await test.step('verify timer payload without focus loop', async () => {
    const projection = electronApp!
      .windows()
      .find((window) => window.url().endsWith('#/projection'))
    if (!projection) throw new Error('Projection window did not open')
    await expect(projection.locator('.timer-digits').first()).toBeVisible()

    await projection.reload()
    await expect(projection.locator('.timer-digits').first()).toBeVisible()
    await projection.waitForTimeout(1200)
    expect(electronApp!.windows()).toHaveLength(2)
  })

  await test.step('browse Files while output remains live', async () => {
    const projection = electronApp!
      .windows()
      .find((window) => window.url().endsWith('#/projection'))
    if (!projection) throw new Error('Projection window did not open')

    await control.locator('a[href="#/files"]').click()
    await expect(control).toHaveURL(/#\/files$/)
    await expect(projection.locator('.timer-digits').first()).toBeVisible()
  })

  await test.step('close projection explicitly from the Header', async () => {
    const projection = electronApp!
      .windows()
      .find((window) => window.url().endsWith('#/projection'))
    if (!projection) throw new Error('Projection window did not open')

    await control.getByRole('button', { name: /Stop projection|停止投影/ }).click()
    await expect.poll(() => electronApp?.windows().length ?? 0).toBe(1)
  })

  await test.step('run bundled FFmpeg and project media through VLC', async () => {
    const ffmpegPath = packagedFfmpegPath(packagedAppPath)
    const fixture = testInfo.outputPath('packaged-vlc-smoke.mkv')
    await execFileAsync(ffmpegPath, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=black:s=32x32:d=1',
      '-c:v',
      'mpeg4',
      '-y',
      fixture
    ])

    await control.evaluate(() => {
      Reflect.set(window, '__packagedVlcStarted', false)
      const unsubscribe = window.api.projectionVlc.onStarted(() => {
        Reflect.set(window, '__packagedVlcStarted', true)
      })
      Reflect.set(window, '__packagedVlcUnsubscribe', unsubscribe)
    })
    const upload = control.locator('input[type="file"]:not([webkitdirectory])').first()
    await upload.setInputFiles(fixture)
    await expect(control.getByText('packaged-vlc-smoke.mkv')).toBeVisible()
    await control.getByText('packaged-vlc-smoke.mkv').dblclick()
    await control.getByTestId('preview-present').click()

    await expect.poll(() => electronApp?.windows().length ?? 0).toBe(2)
    await expect
      .poll(() => control.evaluate(() => Reflect.get(window, '__packagedVlcStarted')))
      .toBe(true)

    await control.getByTestId('media-back-to-files').click()
    await control.getByRole('button', { name: /Stop projection|停止投影/ }).click()
    await expect.poll(() => electronApp?.windows().length ?? 0).toBe(1)
    await control.evaluate(() => {
      const unsubscribe = Reflect.get(window, '__packagedVlcUnsubscribe')
      if (typeof unsubscribe === 'function') unsubscribe()
      Reflect.deleteProperty(window, '__packagedVlcStarted')
      Reflect.deleteProperty(window, '__packagedVlcUnsubscribe')
    })
  })

  await test.step('remove stale HHC native leases on packaged restart', async () => {
    await electronApp!.close()
    electronApp = null

    const staleLeaseDir = join(userDataPath, 'hhc-asset-leases')
    await mkdir(staleLeaseDir, { recursive: true })
    await writeFile(join(staleLeaseDir, 'stale.bin'), 'stale native lease')

    electronApp = await electron.launch({
      executablePath: packagedAppPath,
      args: [`--user-data-dir=${userDataPath}`],
      timeout: 15_000
    })
    const restartedControl = await electronApp.firstWindow()
    await expect(restartedControl).toHaveTitle(/LibrePresenter/)
    await expect
      .poll(async () =>
        access(staleLeaseDir).then(
          () => true,
          () => false
        )
      )
      .toBe(false)
  })
})
