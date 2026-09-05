/* eslint-disable @typescript-eslint/explicit-function-return-type -- Plain JavaScript benchmark. */
import { deepStrictEqual } from 'node:assert'
import { _electron as electron } from '@playwright/test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Run against an unpacked build; all fixtures and preferences stay in a temporary profile.
const executablePath = process.argv[2]
const output = process.argv[3]
if (!executablePath || !output)
  throw new Error('Usage: node scripts/benchmark-media-drag.mjs <executable> <output.json>')
const mode = process.argv[4] ?? 'grid'
const samples = []
for (const count of [30, 300]) {
  const profile = await mkdtemp(join(tmpdir(), 'presenter-drag-'))
  const app = await electron.launch({
    executablePath: resolve(executablePath),
    args: [`--user-data-dir=${profile}`]
  })
  try {
    const page = await app.firstWindow()
    await page.waitForURL(/#\/(welcome|timer)$/)
    if (page.url().endsWith('/welcome')) {
      await page.getByRole('button', { name: /Get Started|開始使用|开始使用/ }).click()
    }
    await page.evaluate(async (count) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 160
      const context = canvas.getContext('2d')
      const gradient = context.createLinearGradient(0, 0, 256, 160)
      gradient.addColorStop(0, '#2450a0')
      gradient.addColorStop(1, '#e2a040')
      context.fillStyle = gradient
      context.fillRect(0, 0, 256, 160)
      context.fillStyle = 'white'
      context.font = '24px sans-serif'
      context.fillText('Media fixture', 32, 80)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const request = indexedDB.open('hhc-file-explorer', 5)
      const db = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const tx = db.transaction(['folder-items', 'file-blobs'], 'readwrite')
      for (let index = 0; index < count; index++) {
        const id = `drag-${index}`
        tx.objectStore('folder-items').put({
          id,
          name: `${String(index).padStart(3, '0')}.png`,
          type: 'file',
          parentId: 'file-root',
          sortIndex: index,
          createdAt: Date.parse(
            index < count / 2 ? '2026-09-04T10:00:00Z' : '2026-09-03T10:00:00Z'
          ),
          expiresAt: null,
          mimeType: 'image/png',
          size: blob.size,
          url: `blob:${id}`
        })
        tx.objectStore('file-blobs').put({ id, blob, refCount: 1 })
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })
      db.close()
      const thumbnailRequest = indexedDB.open('hhc-thumbnails', 4)
      thumbnailRequest.onupgradeneeded = () => {
        const db = thumbnailRequest.result
        if (!db.objectStoreNames.contains('thumbnails'))
          db.createObjectStore('thumbnails', { keyPath: 'itemId' })
        if (!db.objectStoreNames.contains('pdf-page-thumbs'))
          db.createObjectStore('pdf-page-thumbs', { keyPath: 'itemId' })
      }
      const thumbnailDb = await new Promise((resolve, reject) => {
        thumbnailRequest.onsuccess = () => resolve(thumbnailRequest.result)
        thumbnailRequest.onerror = () => reject(thumbnailRequest.error)
      })
      const thumbnailTx = thumbnailDb.transaction('thumbnails', 'readwrite')
      for (let index = 0; index < count; index++)
        thumbnailTx.objectStore('thumbnails').put({ itemId: `drag-${index}`, format: 'blob', blob })
      await new Promise((resolve, reject) => {
        thumbnailTx.oncomplete = resolve
        thumbnailTx.onerror = () => reject(thumbnailTx.error)
      })
      thumbnailDb.close()
    }, count)
    await page.reload()
    await page.getByRole('link', { name: /^FILES$|^檔案$/ }).click()
    await page.locator('[data-file-item][role="button"]').first().waitFor()
    // Wait for the thumbnail queue before measuring drag rather than thumbnail generation.
    await page.waitForFunction(
      (count) => document.querySelectorAll('[data-file-item] img').length >= count,
      count
    )
    if (mode.includes('group')) {
      await page.getByRole('button', { name: 'Sort', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Group', exact: true }).hover()
      await page.getByRole('menuitem', { name: 'Date', exact: true }).click()
    }
    if (mode.includes('list')) {
      await page.getByRole('button', { name: 'View', exact: true }).click()
      await page.getByRole('menuitem', { name: 'List', exact: true }).click()
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus())
    await page.waitForTimeout(350)
    for (let run = 0; run < 3; run++) {
      const cards = page.locator('[data-file-item][role="button"]')
      const expectedOrder = await page.evaluate(
        (count) =>
          JSON.parse(localStorage.getItem('hhc-file-explorer-custom-order') ?? '{}').state
            ?.orders?.['file-root'] ?? Array.from({ length: count }, (_, index) => `drag-${index}`),
        count
      )
      const [moved] = expectedOrder.splice(0, 1)
      expectedOrder.splice(3, 0, moved)
      const first = await cards.nth(0).boundingBox()
      const target = await cards.nth(3).boundingBox()
      await page.evaluate(() => {
        const original = Element.prototype.getBoundingClientRect
        const sample = { reads: 0, frames: [], stop: false, previous: performance.now(), original }
        window.__dragSample = sample
        Element.prototype.getBoundingClientRect = function () {
          sample.reads++
          return original.call(this)
        }
        const tick = (now) => {
          if (sample.stop) return
          sample.frames.push(now - sample.previous)
          sample.previous = now
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      const x = first.x + first.width / 2,
        y = first.y + first.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      for (let step = 1; step <= 60; step++) {
        await page.mouse.move(
          x + ((target.x + target.width / 2 - x) * step) / 60,
          y + ((target.y + target.height / 2 - y) * step) / 60
        )
        await new Promise((resolve) => setTimeout(resolve, 16))
      }
      await page.mouse.up()
      const result = await page.evaluate(() => {
        const sample = window.__dragSample
        sample.stop = true
        Element.prototype.getBoundingClientRect = sample.original
        const frames = sample.frames.slice(1).sort((a, b) => a - b)
        return {
          reads: sample.reads,
          p50: frames[Math.floor(frames.length * 0.5)],
          p95: frames[Math.floor(frames.length * 0.95)],
          max: frames.at(-1),
          frames: frames.length,
          order: JSON.parse(localStorage.getItem('hhc-file-explorer-custom-order') ?? '{}').state
            ?.orders?.['file-root']
        }
      })
      if (!result.order?.length || result.order.length !== count)
        throw new Error('Drag did not persist an order')
      deepStrictEqual(result.order, expectedOrder, 'Stored order must match the requested drag')
      samples.push({ mode, count, run: run + 1, ...result })
      // Let the drop animation settle before starting the next independent sample.
      await page.waitForTimeout(350)
    }
  } finally {
    await app.close()
  }
}
await writeFile(output, JSON.stringify(samples, null, 2) + '\n')
console.log(
  JSON.stringify(
    samples.map(({ order, ...sample }) => ({ ...sample, firstIds: order.slice(0, 6) })),
    null,
    2
  )
)
