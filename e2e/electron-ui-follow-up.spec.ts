import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { completeOnboarding } from './helpers'

test('Electron next after the end screen closes the actual projection window', async ({
  browserName
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'Electron uses Chromium')
  const executablePath = process.env.HHC_ELECTRON_EXECUTABLE
  test.skip(!executablePath, 'Set HHC_ELECTRON_EXECUTABLE to run the built desktop app')
  const userDataPath = await mkdtemp(join(tmpdir(), 'hhc-ui-follow-up-'))
  const app = await electron.launch({
    executablePath,
    args: [resolve('out/main/index.js'), `--user-data-dir=${userDataPath}`]
  })
  try {
    console.log(
      'Desktop launched',
      app.windows().map((page) => page.url())
    )
    const page = await app.firstWindow()
    await completeOnboarding(page)
    await page.getByRole('link', { name: 'FILES', exact: true }).click()
    const imagePath = join(userDataPath, 'End screen.png')
    await writeFile(
      imagePath,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64'
      )
    )
    await page.locator('input[type="file"]:not([webkitdirectory])').first().setInputFiles(imagePath)
    await page.getByText('End screen.png', { exact: true }).dblclick()
    await expect(page).toHaveURL(/#\/media$/)
    const projection = app.windows().find((window) => window !== page)!
    expect(projection).toBeDefined()
    await page.getByRole('button', { name: 'Next', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('End of slides', { exact: true })).toHaveCount(2)
    await page.screenshot({ path: testInfo.outputPath('electron-end-screen.png') })
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => projection.isClosed()).toBe(true)
    await expect(page).toHaveURL(/#\/files$/)
    expect(app.windows()).toHaveLength(1)
    console.log('Electron projection window closed; media session returned to Files')
  } finally {
    const exited = new Promise<void>((resolve) => {
      app.process().once('exit', () => resolve())
    })
    await app
      .evaluate(({ app }) => {
        app.exit(0)
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || !/closed/i.test(error.message)) throw error
      })
    await exited
    await rm(userDataPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})
