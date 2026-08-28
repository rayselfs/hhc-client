import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { completeOnboarding } from './helpers'

async function expectProjectionActionGeometry(action: Locator): Promise<void> {
  await expect(action).toBeVisible()
  await expect(async () => {
    const box = await action.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBe(40)
    expect(box!.height).toBe(40)
    expect(Math.abs(box!.y - 8)).toBeLessThanOrEqual(1)
    expect(Math.abs(1200 - box!.x - box!.width - 8)).toBeLessThanOrEqual(1)
  }).toPass({ timeout: 5_000 })
}

test('keeps the editable presentation stage primary at the 900px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto('/')
  await completeOnboarding(page)

  await page.goto('/#/files')
  await expect(page).toHaveURL(/#\/files$/)
  const projectionAction = page.getByRole('button', {
    name: /Start projection|開始投影|开始投影/
  })
  await expectProjectionActionGeometry(projectionAction)
  await page.getByLabel(/New|新增/).click()
  await page.getByRole('menuitem', { name: /Create Presentation|建立簡報|创建演示文稿/ }).click()
  await expect(page).toHaveURL(/#\/presentations\//)

  await page.getByRole('button', { name: /^(Insert|插入)$/ }).click()
  await page.getByRole('button', { name: /^(Text|文字)$/ }).click()
  await page
    .locator('.presentation-stage [data-slide-surface]')
    .click({ position: { x: 160, y: 120 } })
  const textBox = page.locator('[data-text-content][contenteditable="true"]')
  await textBox.pressSequentially('Supercalifragilisticexpialidocious')
  await textBox.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  )
  const textMetrics = await textBox.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      scrollHeight: element.scrollHeight,
      lineHeight: Number.parseFloat(style.lineHeight),
      verticalPadding: Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
    }
  })
  expect(textMetrics.scrollHeight).toBeLessThanOrEqual(
    textMetrics.lineHeight + textMetrics.verticalPadding + 1
  )
  await page.getByRole('button', { name: /^(Home|常用)$/ }).click()

  await page.setViewportSize({ width: 1470, height: 726 })
  const stageSlot = page.locator('.workspace-stage-slot')
  const presentationStage = page.locator('.presentation-stage')
  const notes = page.getByRole('button', { name: /Toggle Notes|切換備忘稿/ })
  const zoom = page.getByRole('button', { name: /Reset zoom|重設縮放/ })
  await expect(notes).toBeVisible()
  await expect(zoom).toBeVisible()

  const [slotBox, stageBox] = await Promise.all([
    stageSlot.boundingBox(),
    presentationStage.boundingBox()
  ])
  expect(stageBox!.height).toBeLessThanOrEqual(slotBox!.height)
  expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(726)
  await page.setViewportSize({ width: 1200, height: 800 })

  const navigator = page.locator('.workspace-navigator-slot')
  const stage = page.locator('.workspace-stage-slot')
  const slidesTrigger = page.getByRole('button', { name: /Slides|投影片/ })
  const ribbon = page.locator('[data-ribbon-surface]')

  const presentationProjectionAction = page.getByRole('button', {
    name: /Start projection|開始投影|开始投影/
  })
  await expectProjectionActionGeometry(presentationProjectionAction)
  expect(await ribbon.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

  await page.setViewportSize({ width: 900, height: 800 })
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

test('keeps the media sidebar on the right without horizontal overflow at each breakpoint', async ({
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
  const projectionPromise = context.waitForEvent('page')
  await page.getByText('Responsive.png').dblclick()
  const projection = await projectionPromise
  await expect(page).toHaveURL(/#\/media$/)

  const mediaBack = page.getByTestId('media-back-to-files')
  const notes = page.getByRole('textbox')
  const expectRightSidebar = async (): Promise<void> => {
    await expect(notes).toBeVisible()
    const mediaBackBox = await mediaBack.boundingBox()
    const notesBox = await notes.boundingBox()
    expect(mediaBackBox).not.toBeNull()
    expect(notesBox).not.toBeNull()
    expect(notesBox!.x).toBeGreaterThan(mediaBackBox!.x)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
  }

  await expectRightSidebar()

  await page.setViewportSize({ width: 1024, height: 800 })
  await expectRightSidebar()

  await page.setViewportSize({ width: 700, height: 800 })
  await expectRightSidebar()

  await projection.close()
})
