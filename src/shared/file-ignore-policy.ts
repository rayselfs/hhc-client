const IGNORED_SYSTEM_NAMES = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db', 'desktop.ini'])

export function isIgnoredSystemPath(path: string): boolean {
  return path
    .split(/[\\/]/)
    .filter(Boolean)
    .some((part) => IGNORED_SYSTEM_NAMES.has(part))
}

export function isIgnoredSystemFile(file: { name: string; webkitRelativePath?: string }): boolean {
  return isIgnoredSystemPath(file.webkitRelativePath || file.name)
}
