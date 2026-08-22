import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BibleProjection from '../BibleProjection'
import type { BibleChapterData } from '../BibleProjection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'bible.books.joh.name') return 'John'
      if (key === 'bible.chapterUnit.default') return ':'
      if (key === 'bible.chapterUnit.psa') return ':'
      if (key === 'bible.verseUnit') return ''
      return key
    },
    i18n: { language: 'en' }
  })
}))

const chapterData: BibleChapterData = {
  bookNumber: 43,
  chapter: 3,
  chapterVerses: [
    { number: 16, text: 'For God so loved the world' },
    { number: 17, text: 'For God sent not his Son' }
  ],
  currentVerse: 16,
  versionLocale: 'en'
}

describe('BibleProjection', () => {
  it('renders scripture with template colors', () => {
    render(
      <BibleProjection
        data={chapterData}
        settings={{
          fontSize: 88,
          templateTheme: {
            id: 'test',
            name: 'Test',
            fontFamily: 'Inter Variable',
            textColor: '#fff7ed',
            backgroundColor: '#1c140d',
            accentColor: '#f97316'
          }
        }}
      />
    )

    expect(screen.getByTestId('bible-projection')).toHaveStyle({
      backgroundColor: '#1c140d'
    })
    expect(screen.getByText('For God so loved the world')).toHaveStyle({
      color: '#fff7ed'
    })
  })
})
