import { expect, test } from '@playwright/test'
import { completeOnboarding } from './helpers'

test('keeps compact presentation navigator and inspector mutually exclusive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await completeOnboarding(page)

  await page.goto('/#/files')
  await expect(page).toHaveURL(/#\/files$/)
  await page.getByLabel(/New|新增/).click()
  await page.getByRole('menuitem', { name: /Create Presentation|建立簡報|创建演示文稿/ }).click()
  await expect(page).toHaveURL(/#\/presentations\//)

  const slideRail = page.locator('.presentation-slide-rail')
  const inspector = page.locator('.presentation-inspector')

  await page.getByRole('button', { name: /Design|設計/ }).click()
  await page.getByRole('button', { name: /Format Background|設定背景格式/ }).click()
  await expect(slideRail).toBeVisible()
  await expect(inspector).toBeVisible()

  await page.setViewportSize({ width: 1024, height: 800 })
  await expect(slideRail).toBeVisible()
  await expect(inspector).toBeVisible()
  await expect(inspector).toHaveCSS('position', 'absolute')

  await page.setViewportSize({ width: 700, height: 800 })
  await page.getByRole('button', { name: /Open slide rail|開啟投影片/ }).click()
  await expect(slideRail).toBeVisible()
  await page.getByRole('button', { name: /Format Background|設定背景格式/ }).click()
  await expect(slideRail).toBeHidden()
  await expect(inspector).toBeVisible()

  await page.getByRole('button', { name: /Open slide rail|開啟投影片/ }).click()
  await expect(slideRail).toBeVisible()
  await expect(inspector).toBeHidden()

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
