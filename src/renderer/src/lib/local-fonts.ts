interface LocalFontData {
  family: string
}

interface LocalFontAccess {
  queryLocalFonts?: () => Promise<LocalFontData[]>
}

function getLocalFontAccess(): LocalFontAccess {
  return window as unknown as LocalFontAccess
}

export function supportsLocalFontAccess(access = getLocalFontAccess()): boolean {
  return typeof access.queryLocalFonts === 'function'
}

export async function queryLocalFontFamilies(access = getLocalFontAccess()): Promise<string[]> {
  if (!access.queryLocalFonts) return []
  const fonts = await access.queryLocalFonts()
  return [...new Set(fonts.map(({ family }) => family.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  )
}

export function mergeFontFamilies(...groups: Array<readonly string[]>): string[] {
  return [
    ...new Set(
      groups
        .flat()
        .map((family) => family.trim())
        .filter(Boolean)
    )
  ]
}
