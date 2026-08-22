import { describe, expect, it } from 'vitest'
import { buildBibleServiceCueInput } from '../bible-service-cue'
import type { TFunction } from 'i18next'

describe('buildBibleServiceCueInput', () => {
  it('builds a bible service cue input from a passage', () => {
    const t = ((key: string) => {
      if (key === 'bible.books.gen.name') return 'Genesis'
      return key
    }) as unknown as TFunction

    expect(
      buildBibleServiceCueInput(t, {
        bookNumber: 1,
        chapter: 1,
        verse: 1
      })
    ).toEqual({
      type: 'bible',
      title: 'Genesis 1:1',
      bookNumber: 1,
      chapter: 1,
      verse: 1,
      reference: 'Genesis 1:1',
      notes: ''
    })
  })
})
