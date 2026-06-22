import { useRef, useCallback, useEffect } from 'react'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import { formatVerseReference } from '@renderer/lib/bible-utils'
import type { ProjectionPayload } from '@shared/projection-messages'
import { useTranslation } from 'react-i18next'

export type BibleChapterData = {
  bookNumber: number
  chapter: number
  chapterVerses: Array<{ number: number; text: string }>
  currentVerse: number
  versionLocale?: string
}

interface BibleProjectionProps {
  data: BibleChapterData
  settings: ProjectionPayload<'bible:settings'>
}

export default function BibleProjection({
  data,
  settings
}: BibleProjectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { bookNumber, chapter, chapterVerses, currentVerse, versionLocale } = data
  const { fontSize, displayMode = 'full-screen', templateTheme } = settings
  const containerRef = useRef<HTMLDivElement>(null)
  const prevChapterKeyRef = useRef<string>('')
  const isFirstRenderRef = useRef(true)

  const scrollToVerse = useCallback((verseNumber: number, behavior: ScrollBehavior) => {
    const container = containerRef.current
    if (!container) return
    const el = container.querySelector<HTMLElement>(`[data-verse="${verseNumber}"]`)
    if (!el) return
    const top =
      el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    container.scrollTo({ top, behavior })
  }, [])

  useEffect(() => {
    const chapterKey = `${bookNumber}-${chapter}`
    const isChapterChange = prevChapterKeyRef.current !== chapterKey
    prevChapterKeyRef.current = chapterKey

    const behavior: ScrollBehavior =
      isFirstRenderRef.current || isChapterChange ? 'instant' : 'smooth'
    isFirstRenderRef.current = false

    const frame = requestAnimationFrame(() => {
      scrollToVerse(currentVerse, behavior)
    })
    return () => cancelAnimationFrame(frame)
  }, [bookNumber, chapter, currentVerse, scrollToVerse])

  const reference = formatVerseReference(
    t as Parameters<typeof formatVerseReference>[0],
    bookNumber,
    chapter,
    currentVerse,
    i18n.language
  )
  const referenceSize = Math.max(16, fontSize * 0.35)
  const currentVerseData = chapterVerses.find((verse) => verse.number === currentVerse)
  const backgroundColor = templateTheme?.backgroundColor ?? '#000000'
  const textColor = templateTheme?.textColor ?? '#ffffff'
  const accentColor = templateTheme?.accentColor ?? '#0ea5e9'
  const fontFamily = templateTheme?.fontFamily

  if (displayMode === 'lower-third') {
    return (
      <div
        data-testid="bible-projection"
        className="h-screen w-full flex items-end justify-center overflow-hidden p-[5vw]"
        style={{ backgroundColor, fontFamily }}
      >
        <div
          data-testid="bible-lower-third"
          className="w-full rounded-3xl border px-[4vw] py-[3vh] shadow-2xl"
          style={{
            backgroundColor: `${backgroundColor}e6`,
            borderColor: accentColor,
            color: textColor
          }}
        >
          <div
            className="mb-3 font-semibold tracking-wide"
            style={{ color: accentColor, fontSize: `${Math.max(18, fontSize * 0.32)}px` }}
          >
            {reference}
          </div>
          <div
            className="leading-tight"
            lang={versionLocale}
            style={{ fontSize: `${fontSize}px` }}
          >
            {currentVerseData?.text ?? ''}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="bible-projection"
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{ backgroundColor, fontFamily }}
    >
      <div
        className="shrink-0 flex items-center justify-center px-8"
        style={{ height: '60px' }}
      >
        <span className="font-bold" style={{ fontSize: `${referenceSize}px`, color: textColor }}>
          {reference}
        </span>
      </div>

      <GlassDivider thickness={3} />

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarWidth: 'none', pointerEvents: 'none' }}
      >
        {chapterVerses.map((verse) => (
          <div
            key={verse.number}
            data-verse={verse.number}
            className="flex items-start gap-4 px-5 py-3"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: '150%',
              color: textColor
            }}
          >
            <span
              className="shrink-0 font-bold text-right"
              style={{ minWidth: '1.2em', marginRight: '0.5rem' }}
            >
              {verse.number}
            </span>
            <span className="flex-1 text-justify" lang={versionLocale}>
              {verse.text}
            </span>
          </div>
        ))}
        <div style={{ height: '100vh' }} />
      </div>
    </div>
  )
}
