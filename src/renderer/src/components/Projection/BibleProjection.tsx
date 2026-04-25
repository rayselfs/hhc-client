import { useRef, useCallback, useEffect } from 'react'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import { formatVerseReference } from '@renderer/lib/bible-utils'
import { useTranslation } from 'react-i18next'

export type BibleChapterData = {
  bookNumber: number
  chapter: number
  chapterVerses: Array<{ number: number; text: string }>
  currentVerse: number
}

interface BibleProjectionProps {
  data: BibleChapterData
  fontSize: number
}

export default function BibleProjection({
  data,
  fontSize
}: BibleProjectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const { bookNumber, chapter, chapterVerses, currentVerse } = data
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
    currentVerse
  )
  const referenceSize = Math.max(16, fontSize * 0.35)

  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
      <div
        className="shrink-0 flex items-center justify-center bg-black/80 px-8"
        style={{ height: '60px' }}
      >
        <span className="text-white font-bold" style={{ fontSize: `${referenceSize}px` }}>
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
              color: '#ffffff'
            }}
          >
            <span
              className="shrink-0 font-bold text-right"
              style={{ minWidth: '1.2em', marginRight: '0.5rem' }}
            >
              {verse.number}
            </span>
            <span className="flex-1 text-justify">{verse.text}</span>
          </div>
        ))}
        <div style={{ height: '100vh' }} />
      </div>
    </div>
  )
}
