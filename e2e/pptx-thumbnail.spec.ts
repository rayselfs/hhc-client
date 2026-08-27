import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { completeOnboarding } from './helpers'

test('generates a cover thumbnail from a real PPTX file', async ({ page }) => {
  await page.goto('/')
  await completeOnboarding(page)
  await page.goto('/#/files')

  const fixture = resolve('src/renderer/src/lib/__fixtures__/pptx/text-placeholder-layout.pptx')
  await page.locator('input[type="file"]:not([webkitdirectory])').first().setInputFiles(fixture)

  await expect(page.getByText('text-placeholder-layout.pptx')).toBeVisible()
  await expect(page.getByRole('img', { name: 'text-placeholder-layout.pptx' })).toBeVisible()
})
