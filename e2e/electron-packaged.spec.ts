import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { resolve } from 'node:path'
import { completeOnboarding } from './helpers'

let electronApp: ElectronApplication | null = null

test.afterEach(async () => {
  await electronApp?.close()
  electronApp = null
})

test('launches packaged control and projection windows with timer payload delivery', async ({
  browserName: _browserName
}, testInfo) => {
  test.setTimeout(60_000)
  const configuredPath = process.env.PACKAGED_APP_PATH
  if (!configuredPath) throw new Error('PACKAGED_APP_PATH is required')
  const packagedAppPath = resolve(configuredPath)

  await test.step('launch packaged app', async () => {
    electronApp = await electron.launch({
      executablePath: packagedAppPath,
      args: [`--user-data-dir=${testInfo.outputPath('user-data')}`],
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
})
