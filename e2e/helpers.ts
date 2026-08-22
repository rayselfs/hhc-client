import { expect, type Page } from '@playwright/test'

export async function completeOnboarding(page: Page): Promise<void> {
  await expect(page).toHaveURL(/#\/(welcome|timer)$/)
  if (!page.url().endsWith('#/welcome')) return

  await page
    .getByTestId('welcome-page')
    .getByRole('button', { name: /Get Started|開始使用|开始使用/ })
    .click()
  await expect(page).toHaveURL(/#\/timer$/)
}
