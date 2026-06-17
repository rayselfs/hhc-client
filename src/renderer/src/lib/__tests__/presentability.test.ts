import { describe, it, expect } from 'vitest'
import { isPresentable, getMediaType, getPresentableItems } from '@renderer/lib/presentability'
import type { AnyItemRecord, FileItemRecord, VerseItemRecord } from '@shared/types/folder'

describe('isPresentable', () => {
  it.each([
    ['image/png', true],
    ['image/jpeg', true],
    ['image/gif', true],
    ['image/webp', true],
    ['video/mp4', true],
    ['video/webm', true],
    ['video/ogg', true],
    ['video/quicktime', true],
    ['application/pdf', true],
    ['video/x-matroska', false],
    ['text/plain', false],
    ['application/json', false],
    ['audio/mpeg', false]
  ])('isPresentable(%s) → %s', (mime, expected) => {
    expect(isPresentable(mime)).toBe(expected)
  })

  it('allows Electron transcode-required videos as presentation candidates', () => {
    expect(isPresentable('video/x-matroska', 'electron')).toBe(true)
    expect(isPresentable('video/x-matroska', 'web')).toBe(false)
  })
})

describe('getMediaType', () => {
  it.each([
    ['image/png', 'image'],
    ['image/jpeg', 'image'],
    ['video/mp4', 'video'],
    ['video/webm', 'video'],
    ['application/pdf', 'pdf'],
    ['text/plain', null],
    ['audio/mpeg', null]
  ] as const)('getMediaType(%s) → %s', (mime, expected) => {
    expect(getMediaType(mime)).toBe(expected)
  })

  it('resolves Electron transcode-required videos to video', () => {
    expect(getMediaType('video/x-matroska', 'electron')).toBe('video')
    expect(getMediaType('video/x-matroska', 'web')).toBeNull()
  })
})

describe('getPresentableItems', () => {
  const file = (id: string, mimeType: string): FileItemRecord => ({
    id,
    name: `${id}.file`,
    mimeType,
    type: 'file',
    sortIndex: 0,
    parentId: 'root',
    size: 100,
    url: `https://example.com/${id}`,
    createdAt: Date.now(),
    expiresAt: null
  })

  const verse: VerseItemRecord = {
    id: 'v1',
    type: 'verse',
    sortIndex: 0,
    parentId: 'root',
    createdAt: Date.now(),
    expiresAt: null,
    versionId: 1,
    bookNumber: 1,
    chapter: 1,
    verse: 1,
    text: 'In the beginning'
  }

  it('filters to only presentable file items', () => {
    const items: AnyItemRecord[] = [
      file('img', 'image/png'),
      file('vid', 'video/mp4'),
      file('txt', 'text/plain'),
      verse
    ]
    const result = getPresentableItems(items)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('img')
    expect(result[1].id).toBe('vid')
  })

  it('includes Electron transcode-required video candidates', () => {
    const items: AnyItemRecord[] = [
      file('mkv', 'video/x-matroska'),
      file('txt', 'text/plain'),
      verse
    ]
    const result = getPresentableItems(items, 'electron')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('mkv')
  })

  it('returns empty for no presentable items', () => {
    const items: AnyItemRecord[] = [file('txt', 'text/plain'), verse]
    expect(getPresentableItems(items)).toHaveLength(0)
  })
})
