import type { EditablePresentationDocument } from './editable-presentation'
interface LocalFontData {
  family: string
}

interface LocalFontAccess {
  queryLocalFonts?: () => Promise<LocalFontData[]>
}

let localFontFamiliesPromise: Promise<string[]> | null = null

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

export function queryLocalFontFamiliesOnce(access = getLocalFontAccess()): Promise<string[]> {
  localFontFamiliesPromise ??= queryLocalFontFamilies(access).catch((error) => {
    localFontFamiliesPromise = null
    throw error
  })
  return localFontFamiliesPromise
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

export function getDocumentFontFamilies(document: EditablePresentationDocument): string[] {
  return mergeFontFamilies(
    ...Object.values(document.slides).flatMap((slide) =>
      Object.values(slide.elements).flatMap((element) =>
        element.type !== 'text'
          ? []
          : [
              [element.fontFamily],
              element.runs?.map((run) => run.fontFamily) ?? [],
              element.paragraphs?.flatMap((paragraph) => [
                ...(paragraph.typingStyle ? [paragraph.typingStyle.fontFamily] : []),
                ...paragraph.runs.map((run) => run.fontFamily)
              ]) ?? []
            ]
      )
    )
  )
}
