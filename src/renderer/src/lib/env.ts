export function isElectron(): boolean {
  return typeof window !== 'undefined' && 'api' in window && !!window.api
}

export function isWeb(): boolean {
  return !isElectron()
}

interface NavigatorUAData {
  platform: string
}

/**
 * Detect macOS platform.
 *
 * Uses `navigator.userAgentData.platform` (modern, non-deprecated) when available,
 * falling back to `navigator.platform` (universally supported in both Electron's
 * Chromium renderer and all browsers — not affected by custom userAgent strings).
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator as Navigator & { userAgentData?: NavigatorUAData }
  const platform = ua.userAgentData?.platform ?? navigator.platform
  return /mac/i.test(platform)
}

/** Display label for the platform meta key: ⌘ on macOS, Ctrl elsewhere. */
export function getMetaKeyLabel(): string {
  return isMac() ? '⌘' : 'Ctrl'
}
