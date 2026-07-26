import { expect, test } from '@playwright/test'
import { completeOnboarding } from './helpers'

declare global {
  interface Window {
    __projectionFocusCalls: number
    __allowProjectionPopup: boolean
  }
}

test('starts one projection popup and keeps passive timer ticks non-activating', async ({
  page,
  context
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__projectionFocusCalls', {
      value: 0,
      writable: true
    })
    window.focus = () => {
      window.__projectionFocusCalls += 1
    }
  })

  await page.goto('/')
  await completeOnboarding(page)

  const projectionPromise = context.waitForEvent('page')
  await page.getByTestId('btn-start').click()
  const projection = await projectionPromise

  await projection.waitForLoadState('domcontentloaded')
  await expect(projection).toHaveURL(/#\/projection\?generation=[1-9]\d*$/)
  await expect(projection.locator('.timer-digits').first()).toBeVisible()

  const beforeReload = await projection.locator('.timer-digits').first().textContent()
  await projection.reload()
  await expect(projection.locator('.timer-digits').first()).toBeVisible()
  await expect
    .poll(async () => projection.locator('.timer-digits').first().textContent())
    .not.toBeNull()

  await projection.waitForTimeout(1200)

  expect(context.pages()).toHaveLength(2)
  expect(await page.evaluate(() => window.__projectionFocusCalls)).toBe(0)
  expect(beforeReload).not.toBeNull()

  await page.close({ runBeforeUnload: true })
  await expect.poll(() => projection.isClosed()).toBe(true)
})

test('recovers after the browser blocks the projection popup', async ({ page, context }) => {
  await page.addInitScript(() => {
    const nativeOpen = window.open.bind(window)
    Object.defineProperty(window, '__allowProjectionPopup', {
      value: false,
      writable: true
    })
    window.open = (...args) => (window.__allowProjectionPopup ? nativeOpen(...args) : null)
  })

  await page.goto('/')
  await completeOnboarding(page)
  await page.getByTestId('btn-start').click()

  await expect(
    page.getByText(/Projection popup was blocked|投影彈出視窗遭到封鎖|投影弹出窗口被拦截/)
  ).toBeVisible()

  await page.evaluate(() => {
    window.__allowProjectionPopup = true
  })
  const projectionPromise = context.waitForEvent('page')
  await page.getByRole('button', { name: /Retry projection|重試投影|重试投影/ }).click()
  const projection = await projectionPromise

  await expect(projection.locator('.timer-digits').first()).toBeVisible()
  expect(context.pages()).toHaveLength(2)
})

export {}
