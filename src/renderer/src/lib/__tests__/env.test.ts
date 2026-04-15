import { describe, it, expect, afterEach } from 'vitest'
import { isMac, getMetaKeyLabel } from '../env'

describe('isMac()', () => {
  const originalUserAgentData = Object.getOwnPropertyDescriptor(navigator, 'userAgentData')
  const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')

  afterEach(() => {
    if (originalUserAgentData) {
      Object.defineProperty(navigator, 'userAgentData', originalUserAgentData)
    } else {
      Object.defineProperty(navigator, 'userAgentData', {
        value: undefined,
        configurable: true,
        writable: true
      })
    }
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform)
    }
  })

  it('returns true when userAgentData.platform is macOS (modern Chromium/Electron)', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'macOS' },
      configurable: true,
      writable: true
    })
    expect(isMac()).toBe(true)
  })

  it('returns true when userAgentData is unavailable and platform is MacIntel (fallback)', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: undefined,
      configurable: true,
      writable: true
    })
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
      writable: true
    })
    expect(isMac()).toBe(true)
  })

  it('returns false when userAgentData.platform is Windows', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'Windows' },
      configurable: true,
      writable: true
    })
    expect(isMac()).toBe(false)
  })

  it('returns false when userAgentData is unavailable and platform is Linux', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: undefined,
      configurable: true,
      writable: true
    })
    Object.defineProperty(navigator, 'platform', {
      value: 'Linux x86_64',
      configurable: true,
      writable: true
    })
    expect(isMac()).toBe(false)
  })
})

describe('getMetaKeyLabel()', () => {
  const originalUserAgentData = Object.getOwnPropertyDescriptor(navigator, 'userAgentData')
  const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform')

  afterEach(() => {
    if (originalUserAgentData) {
      Object.defineProperty(navigator, 'userAgentData', originalUserAgentData)
    } else {
      Object.defineProperty(navigator, 'userAgentData', {
        value: undefined,
        configurable: true,
        writable: true
      })
    }
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform)
    }
  })

  it('returns ⌘ on Mac', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'macOS' },
      configurable: true,
      writable: true
    })
    expect(getMetaKeyLabel()).toBe('⌘')
  })

  it('returns Ctrl on non-Mac', () => {
    Object.defineProperty(navigator, 'userAgentData', {
      value: { platform: 'Windows' },
      configurable: true,
      writable: true
    })
    expect(getMetaKeyLabel()).toBe('Ctrl')
  })
})
