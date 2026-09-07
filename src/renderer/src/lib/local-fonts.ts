import type { EditablePresentationDocument } from './editable-presentation'
import { loadPresentationFont } from './font-loader'
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

export async function findUnavailablePresentationFonts(families: string[]): Promise<string[]> {
  await Promise.all(families.map((family) => loadPresentationFont(family).catch(() => undefined)))
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return []
  const sample = 'mmmmmmWWWWW漢字0123456789'
  const measure = (font: string): number => {
    context.font = `32px ${font}`
    return context.measureText(sample).width
  }
  const fallbacks = ['monospace', 'serif']
  const widths = fallbacks.map(measure)
  // ponytail: compare two fallback metrics; use an authorized local-font inventory if ambiguous fonts matter.
  return families.filter((family) =>
    fallbacks.every(
      (fallback, index) => measure(`${JSON.stringify(family)}, ${fallback}`) === widths[index]
    )
  )
}
