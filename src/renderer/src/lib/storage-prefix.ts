export const STORAGE_PREFIX = 'hhc-' as const

export function createKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`
}
