import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
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
  await expect(projection).toHaveURL(/#\/projection\?generation=[1-9]\d*&session=[0-9a-f-]+$/i)
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

test('restores the HHC account session without storing the access token', async ({
  page,
  context
}) => {
  const clientOrigin = 'https://client.alive.org.tw'
  const accountOrigin = 'https://account.alive.org.tw'
  const callbackUri = `${clientOrigin}/oauth/callback`
  const accessToken = [
    'header',
    Buffer.from(
      JSON.stringify({
        sub: 'user-1',
        roles: ['media_sync_user'],
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString('base64url'),
    'signature'
  ].join('.')
  let authenticated = false
  let sessionRequests = 0
  let callbackRequests = 0

  await context.route(`${clientOrigin}/**`, async (route) => {
    const url = new URL(route.request().url())
    const response = await page.request.fetch(`http://127.0.0.1:5173${url.pathname}${url.search}`)
    if (url.pathname === '/oauth/callback') {
      callbackRequests += 1
      await route.fulfill({
        status: response.status(),
        contentType: 'text/html',
        headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
        body: (await response.text()).replace('<head>', '<head><base href="/">')
      })
      return
    }
    await route.fulfill({ response })
  })
  await context.route(`${accountOrigin}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const corsHeaders = {
      'access-control-allow-origin': clientOrigin,
      'access-control-allow-credentials': 'true'
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders })
      return
    }
    if (url.pathname === '/api/account/v1/oauth/authorize') {
      expect(url.searchParams.get('redirect_uri')).toBe(callbackUri)
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      const state = url.searchParams.get('state')
      expect(state).toBeTruthy()
      await route.fulfill({
        contentType: 'text/html',
        body: `<script>location.replace(${JSON.stringify(`${callbackUri}?code=code-1&state=${state}`)})</script>`
      })
      return
    }
    if (url.pathname === '/api/account/v1/oauth/token') {
      const body = new URLSearchParams(request.postData() ?? '')
      expect(body.get('redirect_uri')).toBe(callbackUri)
      authenticated = true
      await route.fulfill({
        status: 200,
        headers: {
          ...corsHeaders,
          'content-type': 'application/json',
          'set-cookie':
            'hhc_session=session-1; HttpOnly; Secure; SameSite=Lax; Path=/api/account/v1'
        },
        body: JSON.stringify({ access_token: accessToken })
      })
      return
    }
    if (url.pathname === '/api/account/v1/session') {
      sessionRequests += 1
      const hasSessionCookie = request.headers().cookie?.includes('hhc_session=session-1') ?? false
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify(
          authenticated && hasSessionCookie
            ? { authenticated: true, user: { id: 'user-1', display_name: 'Ada Lovelace' } }
            : { authenticated: false }
        )
      })
      return
    }

    await route.fulfill({ status: 404, headers: corsHeaders })
  })

  await page.goto(`${clientOrigin}/`)
  await completeOnboarding(page)

  await page.getByRole('button', { name: 'Account menu for Guest' }).click()
  const popupPromise = context.waitForEvent('page')
  await page.getByRole('menuitem', { name: 'Login' }).click()
  const popup = await popupPromise
  await expect.poll(() => popup.isClosed()).toBe(true)
  expect(callbackRequests).toBe(1)

  await expect(page.getByRole('button', { name: 'Account menu for Ada Lovelace' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Account menu for Ada Lovelace' })).toBeVisible()
  expect(sessionRequests).toBeGreaterThanOrEqual(3)

  const cookie = (await context.cookies(`${accountOrigin}/api/account/v1/session`)).find(
    ({ name }) => name === 'hhc_session'
  )
  expect(cookie).toMatchObject({ httpOnly: true, secure: true })

  const storageState = await context.storageState({ indexedDB: true })
  expect(JSON.stringify(storageState)).not.toContain(accessToken)
  expect(await page.evaluate(() => Object.values(sessionStorage))).not.toContain(accessToken)
})

test('keeps Media live through Files preview and closes from the Header', async ({
  page,
  context
}) => {
  test.setTimeout(60_000)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )

  await page.goto('/')
  await completeOnboarding(page)
  await page.getByRole('link', { name: /files/i }).click()
  await expect(page).toHaveURL(/#\/files$/)

  const upload = page.locator('input[type="file"]:not([webkitdirectory])').first()
  await upload.setInputFiles({ name: 'First.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('First.png')).toBeVisible()
  await page.getByText('First.png').dblclick()

  const projectionPromise = context.waitForEvent('page')
  await page.getByTestId('preview-present').click()
  const projection = await projectionPromise
  await expect(page).toHaveURL(/#\/media$/)
  await expect(projection.getByRole('img', { name: 'First.png' })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(/#\/media$/)

  await page.setViewportSize({ width: 900, height: 800 })
  const playlistTrigger = page.getByRole('button', { name: 'Playlist' })
  const mediaBack = page.getByTestId('media-back-to-files')
  await expect(playlistTrigger).toBeVisible()
  await expect(mediaBack).toBeVisible()
  const playlistBox = await playlistTrigger.boundingBox()
  const mediaBackBox = await mediaBack.boundingBox()
  expect(playlistBox).not.toBeNull()
  expect(mediaBackBox).not.toBeNull()
  expect(playlistBox!.y + playlistBox!.height).toBeLessThanOrEqual(mediaBackBox!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await playlistTrigger.click()
  await page.getByRole('button', { name: 'Close Playlist' }).click()
  await expect(playlistTrigger).toBeFocused()

  await page.getByTestId('media-back-to-files').click()
  await expect(page).toHaveURL(/#\/files$/)
  await upload.setInputFiles({ name: 'Second.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('Second.png')).toBeVisible()
  await page.getByText('Second.png').dblclick()
  await page.getByRole('button', { name: /Zoom in|放大/ }).click()

  await expect(projection.getByRole('img', { name: 'First.png' })).toBeVisible()
  await page.getByTestId('preview-present').click()
  await expect(page).toHaveURL(/#\/media$/)
  await expect(projection.getByRole('img', { name: 'Second.png' })).toBeVisible()
  expect(context.pages()).toHaveLength(2)

  await page.getByTestId('media-back-to-files').click()
  await expect(page).toHaveURL(/#\/files$/)
  await page.getByRole('button', { name: /Stop projection|停止投影/ }).click()
  await expect.poll(() => projection.isClosed()).toBe(true)
})

test('keeps a read-only PPTX stage primary at the 900px breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await completeOnboarding(page)
  await page.goto('/#/files')

  const fixture = resolve(
    process.cwd(),
    'src/renderer/src/lib/__fixtures__/pptx/text-placeholder-layout.pptx'
  )
  await page.locator('input[type="file"]:not([webkitdirectory])').first().setInputFiles(fixture)
  const file = page.getByText('text-placeholder-layout.pptx')
  await expect(file).toBeVisible()
  await file.click()
  await file.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /Open Presentation|開啟簡報|打开演示文稿/ }).click()
  await expect(page).toHaveURL(/#\/presentations\//)

  await expect(page.locator('[data-pptx-slide-surface] > *').first()).toBeVisible()
  await expect(page.locator('[data-pptx-thumbnail="true"]').first()).toBeVisible()
  await expect(
    page.getByText(/Failed to load presentation|無法載入簡報|无法加载演示文稿/)
  ).toHaveCount(0)

  await page.setViewportSize({ width: 900, height: 800 })

  const navigator = page.locator('.workspace-navigator-slot')
  const stage = page.locator('.workspace-stage-slot')
  const slidesTrigger = page.getByRole('button', { name: /Slides|投影片/ })
  await expect(page.getByRole('button', { name: /Edit a copy|編輯副本/ })).toBeVisible()
  await expect(navigator).toBeHidden()
  await expect(slidesTrigger).toBeVisible()
  await expect(stage).toBeVisible()
  const title = stage.getByText('text-placeholder-layout.pptx', { exact: true })
  const slidesBox = await slidesTrigger.boundingBox()
  const titleBox = await title.boundingBox()
  expect(slidesBox).not.toBeNull()
  expect(titleBox).not.toBeNull()
  expect(slidesBox!.y + slidesBox!.height).toBeLessThanOrEqual(titleBox!.y)

  await slidesTrigger.click()
  await expect(navigator).toBeVisible()
  await page.getByRole('button', { name: /Close (Slides|投影片|幻灯片)/ }).click()
  await expect(slidesTrigger).toBeFocused()
  await expect(navigator).toBeHidden()
  await expect(stage).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )

  await page.getByRole('button', { name: /Edit a copy|編輯副本/ }).click()
  const ribbonFrame = page.getByTestId('presentation-ribbon-frame')
  await expect(ribbonFrame).toBeVisible()
  await page.getByRole('button', { name: /Design|設計|设计/ }).click()
  const formatBackgroundTrigger = ribbonFrame.getByRole('button', {
    name: /Format Background|設定背景格式|设置背景格式/
  })
  await formatBackgroundTrigger.click()
  const inspector = page.locator('.workspace-inspector-slot')
  await expect(inspector).toBeVisible()
  await expect(inspector.locator('.workspace-overlay-close:visible')).toHaveCount(1)
  await expect(inspector.locator('.workspace-inspector-content-close:visible')).toHaveCount(0)
  await inspector.locator('.workspace-overlay-close').click()
  await expect(formatBackgroundTrigger).toBeFocused()

  await page.setViewportSize({ width: 1440, height: 900 })
  await formatBackgroundTrigger.click()
  await expect(inspector).toBeVisible()
  await expect(inspector.locator('.workspace-overlay-close:visible')).toHaveCount(0)
  await expect(inspector.locator('.workspace-inspector-content-close:visible')).toHaveCount(1)
  await inspector.locator('.workspace-inspector-content-close').click()
  await expect(formatBackgroundTrigger).toBeFocused()
})

export {}
