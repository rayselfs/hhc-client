import { describe, it, expect, vi } from 'vitest'

vi.mock('../../bible-book-matcher', () => ({
  getAllBookNames: vi.fn(() => [
    { zhTW: '創世記', zhCN: '创世记', en: 'Genesis' },
    { zhTW: '出埃及記', zhCN: '出埃及记', en: 'Exodus' },
    { zhTW: '啟示錄', zhCN: '启示录', en: 'Revelation' }
  ])
}))

import { getBiblePhrases } from '../bible-phrases'

describe('getBiblePhrases', () => {
  it('returns zh-TW book names + Chinese church terms', () => {
    const phrases = getBiblePhrases('zh-TW')
    expect(phrases).toContain('創世記')
    expect(phrases).toContain('出埃及記')
    expect(phrases).toContain('啟示錄')
    expect(phrases).toContain('耶穌')
    expect(phrases).toContain('阿們')
    expect(phrases).not.toContain('Genesis')
    expect(phrases).not.toContain('Jesus')
  })

  it('returns zh-CN book names + Chinese church terms', () => {
    const phrases = getBiblePhrases('zh-CN')
    expect(phrases).toContain('创世记')
    expect(phrases).toContain('出埃及记')
    expect(phrases).toContain('耶穌')
    expect(phrases).not.toContain('Genesis')
  })

  it('returns English book names + English church terms for en-US', () => {
    const phrases = getBiblePhrases('en-US')
    expect(phrases).toContain('Genesis')
    expect(phrases).toContain('Exodus')
    expect(phrases).toContain('Jesus')
    expect(phrases).toContain('amen')
    expect(phrases).not.toContain('創世記')
    expect(phrases).not.toContain('耶穌')
  })

  it('defaults to English for unknown languages', () => {
    const phrases = getBiblePhrases('ko-KR')
    expect(phrases).toContain('Genesis')
    expect(phrases).toContain('Jesus')
  })

  it('includes book names and church terms (not empty)', () => {
    const phrases = getBiblePhrases('zh-TW')
    expect(phrases.length).toBeGreaterThan(3)
  })
})
