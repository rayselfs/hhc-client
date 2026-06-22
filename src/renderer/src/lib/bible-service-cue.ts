import type { BibleServiceCue } from '@renderer/stores/service-playlist'
import { formatVerseReferenceShort } from '@renderer/lib/bible-utils'
import type { TFunction } from 'i18next'

export type BibleServiceCueInput = Omit<
  BibleServiceCue,
  'id' | 'completed' | 'createdAt' | 'updatedAt'
>

export function buildBibleServiceCueInput(
  t: TFunction,
  passage: {
    bookNumber: number
    chapter: number
    verse: number
  }
): BibleServiceCueInput {
  const reference = formatVerseReferenceShort(
    t,
    passage.bookNumber,
    passage.chapter,
    passage.verse
  )

  return {
    type: 'bible',
    title: reference,
    bookNumber: passage.bookNumber,
    chapter: passage.chapter,
    verse: passage.verse,
    reference,
    notes: ''
  }
}
