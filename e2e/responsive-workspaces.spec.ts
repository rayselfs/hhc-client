import { expect, test } from '@playwright/test'
import { completeOnboarding } from './helpers'

test('keeps the editable presentation stage primary at the 900px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('/')
  await completeOnboarding(page)

  await page.goto('/#/files')
  await expect(page).toHaveURL(/#\/files$/)
  await page.getByLabel(/New|新增/).click()
  await page.getByRole('menuitem', { name: /Create Presentation|建立簡報|创建演示文稿/ }).click()
  await expect(page).toHaveURL(/#\/presentations\//)

  const navigator = page.locator('.workspace-navigator-slot')
  const stage = page.locator('.workspace-stage-slot')
  const slidesTrigger = page.getByRole('button', { name: /Slides|投影片/ })
  const ribbon = page.locator('[data-ribbon-surface]')

  await expect(navigator).toBeHidden()
  await expect(slidesTrigger).toBeVisible()
  await expect(stage).toBeVisible()
  await expect(ribbon).toHaveCSS('overflow-x', 'auto')
  const ribbonMetrics = await ribbon.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }))
  expect(ribbonMetrics.scrollWidth).toBeGreaterThan(ribbonMetrics.clientWidth)

  await page.getByRole('button', { name: /Design|設計/ }).click()
  await page.getByRole('button', { name: /Format Background|設定背景格式/ }).click()
  await expect(page.locator('.workspace-inspector-slot')).toBeVisible()
  await expect(navigator).toBeHidden()

  await slidesTrigger.click()
  await expect(navigator).toBeVisible()
  await expect(page.locator('.workspace-inspector-slot')).toHaveCount(0)
  await page.getByRole('button', { name: /Close (Slides|投影片|幻灯片)/ }).click()
  await expect(navigator).toBeHidden()
  await expect(stage).toBeVisible()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
})

test('keeps media navigator usable without horizontal overflow at each breakpoint', async ({
  page,
  context
}) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await completeOnboarding(page)
  await page.goto('/#/files')
  await page
    .locator('input[type="file"]:not([webkitdirectory])')
    .first()
    .setInputFiles({ name: 'Responsive.png', mimeType: 'image/png', buffer: png })
  await page.getByText('Responsive.png').dblclick()

  const projectionPromise = context.waitForEvent('page')
  await page.getByTestId('preview-present').click()
  const projection = await projectionPromise
  await expect(page).toHaveURL(/#\/media$/)

  const navigator = page.locator('.workspace-navigator-slot')
  const navigatorTrigger = page.locator('.workspace-navigator-trigger')
  await expect(navigator).toBeVisible()

  await page.setViewportSize({ width: 1024, height: 800 })
  await expect(navigator).toBeVisible()
  await expect(navigatorTrigger).toBeHidden()

  await page.setViewportSize({ width: 700, height: 800 })
  await expect(navigator).toBeHidden()
  await expect(navigatorTrigger).toBeVisible()
  await navigatorTrigger.click()
  await expect(navigator).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )

  await projection.close()
})
