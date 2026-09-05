import { expect, test, type Page, type Locator } from '@playwright/test'
import { completeOnboarding } from './helpers'

async function createTextBox(page: Page): Promise<Locator> {
  await page.goto('/')
  await completeOnboarding(page)
  await page.goto('/#/files')
  await page.getByLabel(/New|新增/).click()
  await page.getByRole('menuitem', { name: /Create Presentation|建立簡報|创建演示文稿/ }).click()
  await expect(page).toHaveURL(/#\/presentations\//)
  await page.getByRole('button', { name: /^(Text|Text Box|文字|文字方塊|文本框)$/ }).click()
  await page
    .locator('.presentation-stage [data-slide-surface]')
    .click({ position: { x: 160, y: 120 } })
  return page.locator('.presentation-stage [data-text-content][contenteditable="true"]')
}

test('typing, insertion and whole-text deletion preserve the editable DOM and caret', async ({
  page
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abc', { delay: 40 })
  await textBox.pressSequentially('def', { delay: 40 })
  await expect(textBox).toHaveText('abcdef')
  await textBox.press('Home')
  await textBox.press('ArrowRight')
  await textBox.pressSequentially('X', { delay: 40 })
  await expect(textBox).toHaveText('aXbcdef')
  await textBox.press('Backspace')
  await expect(textBox).toHaveText('abcdef')
  await textBox.press('ControlOrMeta+A')
  await textBox.press('Backspace')
  await textBox.pressSequentially('new', { delay: 40 })
  await expect(textBox).toHaveText('new')
  await textBox.press('Enter')
  await textBox.pressSequentially('line', { delay: 40 })
  await expect(textBox).toHaveText(/new\s*line/)
  await expect(page.getByText(/Failed to execute 'removeChild'/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('deletes across styled runs without losing the document', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abcdef', { delay: 40 })
  await textBox.press('Home')
  for (let index = 0; index < 3; index++) await textBox.press('Shift+ArrowRight')
  await page.getByRole('button', { name: /^(Bold|粗體|加粗)$/ }).click()
  await page.locator('.presentation-stage [data-text-content]').click()
  await textBox.press('Home')
  for (let index = 0; index < 4; index++) await textBox.press('ArrowRight')
  await textBox.press('Backspace')
  await textBox.press('Backspace')
  await expect(textBox).toHaveText('abef')
  await textBox.press('ControlOrMeta+A')
  await textBox.press('Backspace')
  await textBox.pressSequentially('replacement', { delay: 40 })
  await expect(textBox).toHaveText('replacement')
  expect(errors).toEqual([])
})

test('a single click resumes editing after clicking outside the text box', async ({ page }) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('中文測試 abc', { delay: 40 })
  const content = page.locator('.presentation-stage [data-text-content]')
  for (let attempt = 0; attempt < 3; attempt++) {
    await page
      .locator('.presentation-stage [data-slide-surface]')
      .click({ position: { x: 500, y: 250 } })
    await expect(content).toHaveAttribute('contenteditable', 'false')
    await content.click()
    await expect(content).toHaveAttribute('contenteditable', 'true')
    await expect(content).toBeFocused()
    await content.press('End')
    await content.pressSequentially('x')
    await expect(content).toHaveText(`中文測試 abc${'x'.repeat(attempt + 1)}`)
  }
})
