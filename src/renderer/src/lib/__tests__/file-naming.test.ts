import { describe, expect, it } from 'vitest'
import {
  hasNameConflict,
  resolveUniqueFileName,
  resolveUniqueName,
  splitFileName,
  validateDisplayName
} from '../file-naming'

describe('file naming helpers', () => {
  it.each([
    ['photo.jpg', { base: 'photo', extension: '.jpg' }],
    ['archive.tar.gz', { base: 'archive.tar', extension: '.gz' }],
    ['.env', { base: '.env', extension: '' }],
    ['README', { base: 'README', extension: '' }]
  ])('splits %s', (name, expected) => {
    expect(splitFileName(name)).toEqual(expected)
  })

  it.each(['', '   ', '.', '..', 'a/b', 'a\\b'])('rejects invalid display name %s', (name) => {
    expect(validateDisplayName(name)).toBe(false)
  })

  it('detects case-insensitive conflicts while allowing excluded names', () => {
    expect(hasNameConflict('slides.pdf', ['Slides.PDF'])).toBe(true)
    expect(hasNameConflict('slides.pdf', ['Slides.PDF'], { excludeName: 'Slides.PDF' })).toBe(false)
  })

  it('resolves duplicate folder and file names with suffixes', () => {
    expect(resolveUniqueName('Folder', ['folder', 'Folder 2'])).toBe('Folder 3')
    expect(resolveUniqueFileName('photo.jpg', ['Photo.jpg', 'photo 2.jpg'])).toBe('photo 3.jpg')
  })
})
