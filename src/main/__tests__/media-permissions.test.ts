import { it, expect } from 'vitest'
import { isTrustedMediaFrame } from '../media-permissions'

it('allows only the app main frame URL, preserving hash routes', () => {
  expect(
    isTrustedMediaFrame('file:///app/index.html#/media', 'file:///app/index.html#/timer', true)
  ).toBe(true)
  expect(isTrustedMediaFrame('file:///tmp/other.html', 'file:///app/index.html', true)).toBe(false)
  expect(isTrustedMediaFrame('https://evil.example', 'http://localhost:5173', true)).toBe(false)
  expect(isTrustedMediaFrame('http://localhost:5173/', 'http://localhost:5173/', false)).toBe(false)
  expect(isTrustedMediaFrame(undefined, 'file:///app/index.html', true)).toBe(false)
})

it('restricts capture to main contents while retaining existing audio capture', async () => {
  const { registerMediaPermissions } = await import('../media-permissions')
  const main = { getURL: () => 'file:///app/index.html' }
  let check!: Parameters<Electron.Session['setPermissionCheckHandler']>[0]
  let request!: Parameters<Electron.Session['setPermissionRequestHandler']>[0]
  const session = {
    setPermissionCheckHandler: (handler: typeof check): void => {
      check = handler
    },
    setPermissionRequestHandler: (handler: typeof request): void => {
      request = handler
    }
  } as Electron.Session
  registerMediaPermissions(session, () => main as Electron.WebContents)
  const details = { requestingUrl: 'file:///app/index.html', isMainFrame: true }
  expect(check!(null, 'media', 'file://', details)).toBe(false)
  expect(check!(main as Electron.WebContents, 'media', 'file://', details)).toBe(true)
  const result: boolean[] = []
  request!(main as Electron.WebContents, 'media', (value) => result.push(value), {
    ...details,
    mediaTypes: ['audio']
  })
  request!(main as Electron.WebContents, 'media', (value) => result.push(value), {
    ...details,
    mediaTypes: ['video']
  })
  request!({} as Electron.WebContents, 'media', (value) => result.push(value), {
    ...details,
    mediaTypes: ['video']
  })
  request!(main as Electron.WebContents, 'media', (value) => result.push(value), {
    ...details,
    isMainFrame: false,
    mediaTypes: ['video']
  })
  expect(result).toEqual([true, true, false, false])
})
