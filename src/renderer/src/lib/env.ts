export function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electron' in window
}

export function isWeb(): boolean {
  return typeof window !== 'undefined' && !('electron' in window)
}
