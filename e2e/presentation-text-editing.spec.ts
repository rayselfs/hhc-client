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

test('formatting preserves the five selected characters and derives caret bold state', async ({
  page
}) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abcde plain', { delay: 40 })
  await textBox.press('Home')
  for (let index = 0; index < 5; index++) await textBox.press('Shift+ArrowRight')
  const bold = page.getByRole('button', { name: /^(Bold|粗體|加粗)$/ })
  await bold.click()
  await expect(textBox).toBeFocused()
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('abcde')
  await textBox.press('ArrowRight')
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  await textBox.press('ArrowRight')
  await expect(bold).toHaveAttribute('aria-pressed', 'false')
})

test('keyboard formatting uses the same selected range as the toolbar', async ({ page }) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abcde plain', { delay: 40 })
  await textBox.press('Home')
  for (let index = 0; index < 5; index++) await textBox.press('Shift+ArrowRight')
  await textBox.press('ControlOrMeta+B')
  await expect(page.getByRole('button', { name: /^(Bold|粗體|加粗)$/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('abcde')
  await textBox.press('ControlOrMeta+I')
  await expect(page.getByRole('button', { name: /^(Italic|斜體|斜体)$/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(textBox).toHaveText('abcde plain')
})

test('a formatting popup retains the range and returns focus after applying', async ({ page }) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abcde plain', { delay: 40 })
  await textBox.press('Home')
  for (let index = 0; index < 5; index++) await textBox.press('Shift+ArrowRight')
  await page.getByRole('button', { name: 'Change case', exact: true }).click()
  await page.getByRole('button', { name: 'UPPERCASE', exact: true }).click()
  await expect(textBox).toBeFocused()
  await expect(textBox).toHaveText('ABCDE plain')
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('ABCDE')
})

test('formatting preserves a backward selection', async ({ page }) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abcde', { delay: 40 })
  for (let index = 0; index < 5; index++) await textBox.press('Shift+ArrowLeft')
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('abcde')
  await textBox.press('Shift+ArrowRight')
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('bcde')
})

test('paragraph alignment and list state follow the caret and an empty list exits on Enter', async ({
  page
}) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('First', { delay: 40 })
  await page.getByRole('button', { name: 'Center', exact: true }).click()
  await page.getByRole('button', { name: 'Bullets', exact: true }).click()
  await textBox.press('Enter')
  await expect(page.getByRole('button', { name: 'Bullets', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await textBox.press('Enter')
  await expect(page.getByRole('button', { name: 'Bullets', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  )
  await expect(page.getByRole('button', { name: 'Center', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await textBox.pressSequentially('Second')
  await page.getByRole('button', { name: 'Align left', exact: true }).click()
  await textBox.press('ArrowUp')
  await textBox.press('Home')
  await expect(page.getByRole('button', { name: 'Center', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.getByRole('button', { name: 'Bullets', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('undo and redo keep formatting separate from typing', async ({ page }) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abcde', { delay: 40 })
  await textBox.press('ControlOrMeta+A')
  const bold = page.getByRole('button', { name: 'Bold', exact: true })
  await bold.click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  const content = page.locator('.presentation-stage [data-text-content]')
  await content.click()
  await textBox.press('ControlOrMeta+A')
  await expect(textBox).toHaveText('abcde')
  await expect(bold).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await content.click()
  await textBox.press('ControlOrMeta+A')
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
})

test('font search and a custom 13 point size preserve the selected text', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'queryLocalFonts', {
      value: async () => [{ family: 'Arial' }, { family: 'Microsoft Sans Serif' }],
      configurable: true
    })
  })
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('abcde plain', { delay: 40 })
  await textBox.press('Home')
  for (let index = 0; index < 5; index++) await textBox.press('Shift+ArrowRight')
  const font = page.getByRole('button', { name: 'Font family', exact: true })
  await font.click()
  const search = page.getByRole('textbox', { name: 'Search fonts', exact: true })
  await search.fill('Arial')
  await page.getByRole('option', { name: /Arial/ }).click()
  await expect(textBox).toBeFocused()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('abcde')
  await expect(textBox.locator('[data-text-run]').first()).toHaveCSS('font-family', 'Arial')
  const size = page.getByRole('textbox', { name: 'Font size', exact: true })
  await size.fill('13')
  await size.press('Enter')
  await expect(textBox).toBeFocused()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('abcde')
  await expect(size).toHaveValue('13')
  await font.click()
  await search.fill('Microsoft')
  await expect(page.getByRole('option', { name: /Microsoft Sans Serif/ })).toBeVisible()
  await search.press('Escape')
})

test('an abandoned new text box is removed without leaving undo history', async ({ page }) => {
  await createTextBox(page)
  await page.getByRole('button', { name: 'Font family', exact: true }).click()
  await expect(page.locator('.presentation-stage [data-slide-element]')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Search fonts', exact: true }).press('Escape')
  await page
    .locator('.presentation-stage [data-slide-surface]')
    .click({ position: { x: 500, y: 250 } })
  await expect(page.locator('.presentation-stage [data-slide-element]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
})

test('deleting previously entered text keeps the existing box', async ({ page }) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('Keep this box', { delay: 40 })
  await textBox.press('ControlOrMeta+A')
  await textBox.press('Backspace')
  await page
    .locator('.presentation-stage [data-slide-surface]')
    .click({ position: { x: 500, y: 250 } })
  await expect(page.locator('.presentation-stage [data-slide-element]')).toHaveCount(1)
})

test('content-height text has horizontal handles and an undoable rotation handle', async ({
  page
}) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('Rotate me', { delay: 40 })
  await expect(page.getByRole('button', { name: 'Resize text box top', exact: true })).toHaveCount(
    0
  )
  await page.getByRole('button', { name: 'Rotate object', exact: true }).press('Shift+ArrowRight')
  const element = page.locator('.presentation-stage [data-slide-element]')
  await expect(element).toHaveAttribute('style', /rotate\(15deg\)/)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(element).toHaveAttribute('style', /rotate\(0deg\)/)
})

test('slide shortcuts and native clipboard events share scope without double pasting', async ({
  page
}) => {
  const textBox = await createTextBox(page)
  await textBox.pressSequentially('Slide content', { delay: 40 })
  const slides = page.locator('[data-slide-option]')
  await slides.first().click()
  await slides.first().press('ControlOrMeta+C')
  await slides.first().press('ControlOrMeta+V')
  await expect(slides).toHaveCount(2)
  await slides.last().click()
  await slides
    .last()
    .evaluate((node) =>
      node.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true }))
    )
  await slides
    .last()
    .evaluate((node) =>
      node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))
    )
  await expect(slides).toHaveCount(3)
  await slides.last().click()
  await slides.last().press('ControlOrMeta+X')
  await expect(slides).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(slides).toHaveCount(3)
})
