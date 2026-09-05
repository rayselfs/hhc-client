import { expect, test } from '@playwright/test'
import { completeOnboarding } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await completeOnboarding(page)
})

for (const label of ['About', 'Keyboard Shortcuts', 'Preferences']) {
  test(`${label} leaves the account trigger in place`, async ({ page }) => {
    const account = page.getByRole('button', { name: 'Account menu for Guest' })
    await page.evaluate(() => document.fonts.ready)
    const before = await account.boundingBox()
    await account.click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    await expect(page.locator('[data-slot="modal-dialog"]')).toBeVisible()
    expect(before).not.toBeNull()
    await expect
      .poll(async () => {
        const after = await account.boundingBox()
        return Math.max(Math.abs(after!.y - before!.y), Math.abs(after!.x - before!.x))
      })
      .toBeLessThanOrEqual(1)
  })
}

test('outside right click dismisses the current menu before opening another', async ({ page }) => {
  await page.goto('/#/files')
  await page.getByRole('button', { name: 'Account menu for Guest' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.locator('body').click({ button: 'right', position: { x: 800, y: 400 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.getByLabel('New', { exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.locator('body').click({ button: 'right', position: { x: 800, y: 400 } })
  await expect(page.getByRole('menu')).toHaveCount(0)
})
