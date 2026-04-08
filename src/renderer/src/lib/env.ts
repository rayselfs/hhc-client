export function isElectron(): boolean {
  return typeof window !== 'undefined' && 'api' in window && !!window.api
}

export function isWeb(): boolean {
  return !isElectron()
}
