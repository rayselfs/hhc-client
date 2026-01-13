export const isMac = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
}
