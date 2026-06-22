export function isTimerRoute(pathname: string): boolean {
  return pathname === '/timer'
}

export function isBibleRoute(pathname: string): boolean {
  return pathname === '/bible'
}

export function isServiceRoute(pathname: string): boolean {
  return pathname === '/service'
}

export function isSlidesRoute(pathname: string): boolean {
  return pathname === '/slides'
}

export function isFilesRoute(pathname: string): boolean {
  return pathname === '/files'
}

export function isFavoritesRoute(pathname: string): boolean {
  return pathname === '/favorites'
}

export function isTrashRoute(pathname: string): boolean {
  return pathname === '/trash'
}
