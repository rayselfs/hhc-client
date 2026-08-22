export interface SplitFileName {
  base: string
  extension: string
}

export function normalizeNameForCompare(name: string): string {
  return name.trim().toLocaleLowerCase('en-US')
}

export function splitFileName(name: string): SplitFileName {
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === name.length - 1) return { base: name, extension: '' }
  return {
    base: name.slice(0, lastDot),
    extension: name.slice(lastDot)
  }
}

export function validateDisplayName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..') return false
  return !/[\\/]/.test(trimmed)
}

export function hasNameConflict(
  name: string,
  existingNames: Iterable<string>,
  options: { excludeName?: string } = {}
): boolean {
  const normalized = normalizeNameForCompare(name)
  const excluded = options.excludeName ? normalizeNameForCompare(options.excludeName) : null
  for (const existingName of existingNames) {
    const current = normalizeNameForCompare(existingName)
    if (current === excluded) continue
    if (current === normalized) return true
  }
  return false
}

export function resolveUniqueName(baseName: string, existingNames: Iterable<string>): string {
  const trimmed = baseName.trim()
  const used = new Set([...existingNames].map(normalizeNameForCompare))
  if (!used.has(normalizeNameForCompare(trimmed))) return trimmed

  let index = 2
  while (used.has(normalizeNameForCompare(`${trimmed} ${index}`))) index++
  return `${trimmed} ${index}`
}

export function resolveUniqueFileName(name: string, existingNames: Iterable<string>): string {
  const trimmed = name.trim()
  const used = new Set([...existingNames].map(normalizeNameForCompare))
  if (!used.has(normalizeNameForCompare(trimmed))) return trimmed

  const { base, extension } = splitFileName(trimmed)
  let index = 2
  while (used.has(normalizeNameForCompare(`${base} ${index}${extension}`))) index++
  return `${base} ${index}${extension}`
}
