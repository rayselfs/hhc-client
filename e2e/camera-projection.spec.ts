import { expect, test } from '@playwright/test'
import { completeOnboarding } from './helpers'

test.use({
  launchOptions: {
    channel: 'chromium',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  },
  permissions: ['camera']
})

test('projects one camera with matching framing, survives navigation and reload, then releases capture', async ({
  page,
  context
}) => {
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    Reflect.set(window, '__cameraTracks', [])
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints)
      Reflect.get(window, '__cameraTracks').push(...stream.getTracks())
      return stream
    }
  })
  await page.goto('/')
  await completeOnboarding(page)
  await page.goto('/#/camera')
  const workspace = page.locator('section').filter({ has: page.getByTestId('camera-editor') })
  await workspace.getByRole('button', { name: /Enable camera|啟用攝影機|启用摄像头/ }).click()
  await expect
    .poll(() =>
      page
        .locator('[data-testid=camera-editor] video')
        .evaluate((video: HTMLVideoElement) => video.videoWidth)
    )
    .toBeGreaterThan(0)
  const popup = context.waitForEvent('page')
  await workspace.getByRole('button', { name: /^Start projection$|^開始投影$|^开始投影$/ }).click()
  const projection = await popup
  await expect(projection.getByTestId('camera-projection')).toBeVisible()
  await expect
    .poll(
      () => projection.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth),
      { timeout: 15000 }
    )
    .toBeGreaterThan(0)
  const editor = page.getByTestId('camera-editor')
  const bounds = await editor.boundingBox()
  if (!bounds) throw new Error('Camera editor is not visible')
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height / 2)
  await page.mouse.up()
  await expect(workspace.getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue('192')
  await editor.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(workspace.getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue('202')
  const handle = await page.getByTestId('camera-resize-se').boundingBox()
  if (!handle) throw new Error('Resize handle is not visible')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x - bounds.width * 0.1, handle.y - bounds.height * 0.1)
  await page.mouse.up()
  const frame = JSON.parse((await editor.getByTestId('camera-stage').getAttribute('data-frame'))!)
  expect(frame.width).toBeLessThan(1920)
  expect(frame.width / frame.height).toBeCloseTo(16 / 9)
  await expect
    .poll(() => projection.getByTestId('camera-stage').getAttribute('data-frame'))
    .toBe(JSON.stringify(frame))
  await workspace.getByRole('button', { name: /Reset position|重設位置|重设位置/ }).click()
  await expect(workspace.getByRole('spinbutton', { name: 'X', exact: true })).toHaveValue('0')
  await workspace.getByRole('spinbutton', { name: 'X', exact: true }).fill('120')
  await expect
    .poll(() => projection.getByTestId('camera-stage').getAttribute('data-frame'))
    .toContain('"x":120')
  await workspace.getByRole('spinbutton', { name: /Width|寬度|宽度/ }).fill('960')
  await expect
    .poll(() => projection.getByTestId('camera-stage').getAttribute('data-frame'))
    .toContain('"width":960')
  await workspace.getByRole('link', { name: /Back to media|返回多媒體|返回多媒体/ }).click()
  await expect(projection.getByTestId('camera-projection')).toBeVisible()
  await projection.reload()
  await expect
    .poll(
      () => projection.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth),
      { timeout: 15000 }
    )
    .toBeGreaterThan(0)
  await page
    .getByRole('button', { name: /Camera projection|攝影機投影|摄像头投影/, exact: true })
    .click()
  await page.evaluate(() => {
    for (const track of Reflect.get(window, '__cameraTracks') as MediaStreamTrack[]) {
      track.stop()
      track.dispatchEvent(new Event('ended'))
    }
  })
  await expect(workspace.getByRole('alert')).toBeVisible()
  await expect
    .poll(() =>
      projection.locator('video').evaluate((video: HTMLVideoElement) => video.srcObject === null)
    )
    .toBe(true)
  await workspace.getByRole('button', { name: /^Retry$|^重試$|^重试$/ }).click()
  await expect
    .poll(
      () => projection.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth),
      { timeout: 15000 }
    )
    .toBeGreaterThan(0)
  await workspace.getByRole('button', { name: /^Stop projection$|^停止投影$/ }).click()
  await expect.poll(() => projection.isClosed()).toBe(true)
  await workspace.getByRole('link', { name: /Back to media|返回多媒體|返回多媒体/ }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Reflect.get(window, '__cameraTracks').filter(
            (track: MediaStreamTrack) => track.readyState === 'live'
          ).length
      )
    )
    .toBe(0)
})

test('allows retry after camera permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    let denied = false
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!denied) {
        denied = true
        throw new DOMException('Denied by test', 'NotAllowedError')
      }
      return capture(constraints)
    }
  })
  await page.goto('/')
  await completeOnboarding(page)
  await page.goto('/#/camera')
  const workspace = page.locator('section').filter({ has: page.getByTestId('camera-editor') })
  await workspace.getByRole('button', { name: /Enable camera|啟用攝影機|启用摄像头/ }).click()
  await expect(workspace.getByRole('alert')).toBeVisible()
  await expect(
    workspace.getByRole('button', { name: /^Start projection$|^開始投影$|^开始投影$/ })
  ).toBeDisabled()
  await workspace.getByRole('button', { name: /^Retry$|^重試$|^重试$/ }).click()
  await expect(workspace.getByRole('alert')).toHaveCount(0)
  await expect
    .poll(() => workspace.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth))
    .toBeGreaterThan(0)
})
