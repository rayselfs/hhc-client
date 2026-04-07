export const STORAGE_PREFIX = 'hhc-' as const

export function createStorageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`
}
