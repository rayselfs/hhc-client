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

  const fit = page.getByRole('button', { name: /^Fit$|^符合視窗$/ })
  const zoomSlider = page.getByRole('slider', { name: /Zoom|縮放/ })
  await expect(fit).toHaveAttribute('aria-pressed', 'true')

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
  const viewport = page.getByTestId('presentation-canvas-viewport')
  const canvas = page.getByTestId('presentation-canvas')
  await expect(notes).toBeVisible()
  await expect(zoom).toBeVisible()

  const expectedFitZoom = async (): Promise<number> =>
    viewport.evaluate((element) =>
      Math.max(
        25,
        Math.min(
          200,
          Math.floor(
            Math.min((element.clientWidth - 64) / 1024, (element.clientHeight - 64) / 576) * 100
          )
        )
      )
    )
  const expectExactFitGeometry = async (): Promise<number> => {
    const expected = await expectedFitZoom()
    await expect(zoomSlider).toHaveValue(String(expected))
    await expect(zoom).toHaveText(`${expected}%`)
    await expect
      .poll(async () => (await canvas.boundingBox())?.width)
      .toBeCloseTo((1024 * expected) / 100, 0)
    return expected
  }

  const fitZoom = await expectExactFitGeometry()
  await notes.click()
  const notesEditor = page.getByRole('textbox', { name: /Notes|備忘稿/ })
  await notesEditor.fill('Responsive speaker note')
  await expect.poll(async () => Number(await zoomSlider.inputValue())).toBeLessThan(fitZoom)
  await expectExactFitGeometry()
  await notes.click()
  await notes.click()
  await expect(notesEditor).toHaveValue('Responsive speaker note')
  await notes.click()

  await zoomSlider.fill('150')
  await expect(zoomSlider).toHaveValue('150')
  await viewport.evaluate((element) => {
    element.scrollLeft = 220
    element.scrollTop = 140
  })
  const viewportBox = await viewport.boundingBox()
  const canvasBeforeWheel = await canvas.boundingBox()
  const pointer = {
    x: viewportBox!.x + viewportBox!.width * 0.31,
    y: viewportBox!.y + viewportBox!.height * 0.37
  }
  const logicalBeforeWheel = {
    x: ((pointer.x - canvasBeforeWheel!.x) * 1024) / canvasBeforeWheel!.width,
    y: ((pointer.y - canvasBeforeWheel!.y) * 576) / canvasBeforeWheel!.height
  }
  const zoomBeforeWheel = await zoom.textContent()
  const ctrlWheelPrevented = await viewport.evaluate((element, position) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: position.x,
      clientY: position.y,
      ctrlKey: true,
      deltaY: -100
    })
    element.dispatchEvent(event)
    return event.defaultPrevented
  }, pointer)
  expect(ctrlWheelPrevented).toBe(true)
  await expect.poll(() => zoom.textContent()).not.toBe(zoomBeforeWheel)
  const canvasAfterWheel = await canvas.boundingBox()
  expect(((pointer.x - canvasAfterWheel!.x) * 1024) / canvasAfterWheel!.width).toBeCloseTo(
    logicalBeforeWheel.x,
    0
  )
  expect(((pointer.y - canvasAfterWheel!.y) * 576) / canvasAfterWheel!.height).toBeCloseTo(
    logicalBeforeWheel.y,
    0
  )

  await zoomSlider.fill('200')
  await expect(zoomSlider).toHaveValue('200')
  const overflow = await viewport.evaluate((element) => {
    element.scrollLeft = 0
    element.scrollTop = 0
    return {
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight
    }
  })
  expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth)
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight)
  const [viewportAtStart, canvasAtStart] = await Promise.all([
    viewport.boundingBox(),
    canvas.boundingBox()
  ])
  expect(canvasAtStart!.x - viewportAtStart!.x).toBeCloseTo(32, 0)
  expect(canvasAtStart!.y - viewportAtStart!.y).toBeCloseTo(32, 0)
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth
    element.scrollTop = element.scrollHeight - element.clientHeight
  })
  const [viewportAtEnd, canvasAtEnd] = await Promise.all([
    viewport.boundingBox(),
    canvas.boundingBox()
  ])
  expect(viewportAtEnd!.x + viewportAtEnd!.width - canvasAtEnd!.x - canvasAtEnd!.width).toBeCloseTo(
    32,
    0
  )
  expect(
    viewportAtEnd!.y + viewportAtEnd!.height - canvasAtEnd!.y - canvasAtEnd!.height
  ).toBeCloseTo(32, 0)
  const statusBar = page.getByTestId('presentation-status-bar')
  const [statusBox, customStageBox] = await Promise.all([
    statusBar.boundingBox(),
    presentationStage.boundingBox()
  ])
  expect(statusBox!.y + statusBox!.height).toBeLessThanOrEqual(
    customStageBox!.y + customStageBox!.height
  )

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
