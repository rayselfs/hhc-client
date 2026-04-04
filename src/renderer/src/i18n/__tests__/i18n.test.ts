import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import i18n, { LANGUAGE_STORAGE_KEY } from '../index'

function mockNavigatorLanguage(lang: string): void {
  Object.defineProperty(window.navigator, 'language', {
    writable: true,
    configurable: true,
    value: lang
  })
}

beforeEach(() => {
  localStorage.clear()
  mockNavigatorLanguage('en-US')
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('i18n configuration', () => {
  it('exports LANGUAGE_STORAGE_KEY as hhc-language', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('hhc-language')
  })

  it('initializes with default language en', () => {
    expect(i18n.language).toBe('en')
  })

  it('initializes with fallback language en', () => {
    expect(i18n.options.fallbackLng).toEqual(['en'])
  })

  it('has interpolation.escapeValue set to false', () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false)
  })
})

describe('language detection (via translation keys)', () => {
  it('loads all 3 locale bundles', () => {
    expect(i18n.getResourceBundle('en', 'translation')).toBeDefined()
    expect(i18n.getResourceBundle('zh-TW', 'translation')).toBeDefined()
    expect(i18n.getResourceBundle('zh-CN', 'translation')).toBeDefined()
  })
})

describe('translations', () => {
  it('has nav.timer key in all locales', () => {
    expect(i18n.getResourceBundle('en', 'translation')).toHaveProperty('nav.timer')
    expect(i18n.getResourceBundle('zh-TW', 'translation')).toHaveProperty('nav.timer')
    expect(i18n.getResourceBundle('zh-CN', 'translation')).toHaveProperty('nav.timer')
  })

  it('has nav.bible key in all locales', () => {
    expect(i18n.getResourceBundle('en', 'translation')).toHaveProperty('nav.bible')
    expect(i18n.getResourceBundle('zh-TW', 'translation')).toHaveProperty('nav.bible')
    expect(i18n.getResourceBundle('zh-CN', 'translation')).toHaveProperty('nav.bible')
  })

  it('has timer.title key in all locales', () => {
    expect(i18n.getResourceBundle('en', 'translation')).toHaveProperty('timer.title')
    expect(i18n.getResourceBundle('zh-TW', 'translation')).toHaveProperty('timer.title')
    expect(i18n.getResourceBundle('zh-CN', 'translation')).toHaveProperty('timer.title')
  })

  it('has bible.title key in all locales', () => {
    expect(i18n.getResourceBundle('en', 'translation')).toHaveProperty('bible.title')
    expect(i18n.getResourceBundle('zh-TW', 'translation')).toHaveProperty('bible.title')
    expect(i18n.getResourceBundle('zh-CN', 'translation')).toHaveProperty('bible.title')
  })

  it('translates nav.timer to TIMER in en', () => {
    expect(i18n.t('nav.timer', { lng: 'en' })).toBe('TIMER')
  })

  it('translates nav.timer to 計時器 in zh-TW', () => {
    expect(i18n.t('nav.timer', { lng: 'zh-TW' })).toBe('計時器')
  })

  it('translates nav.timer to 计时器 in zh-CN', () => {
    expect(i18n.t('nav.timer', { lng: 'zh-CN' })).toBe('计时器')
  })

  it('translates nav.bible to BIBLE in en', () => {
    expect(i18n.t('nav.bible', { lng: 'en' })).toBe('BIBLE')
  })

  it('translates nav.bible to 聖經 in zh-TW', () => {
    expect(i18n.t('nav.bible', { lng: 'zh-TW' })).toBe('聖經')
  })

  it('translates nav.bible to 圣经 in zh-CN', () => {
    expect(i18n.t('nav.bible', { lng: 'zh-CN' })).toBe('圣经')
  })

  it('translates timer.title to TIMER in en', () => {
    expect(i18n.t('timer.title', { lng: 'en' })).toBe('TIMER')
  })

  it('translates timer.title to 計時器 in zh-TW', () => {
    expect(i18n.t('timer.title', { lng: 'zh-TW' })).toBe('計時器')
  })

  it('translates timer.title to 计时器 in zh-CN', () => {
    expect(i18n.t('timer.title', { lng: 'zh-CN' })).toBe('计时器')
  })

  it('translates bible.title to BIBLE in en', () => {
    expect(i18n.t('bible.title', { lng: 'en' })).toBe('BIBLE')
  })

  it('translates bible.title to 聖經 in zh-TW', () => {
    expect(i18n.t('bible.title', { lng: 'zh-TW' })).toBe('聖經')
  })

  it('translates bible.title to 圣经 in zh-CN', () => {
    expect(i18n.t('bible.title', { lng: 'zh-CN' })).toBe('圣经')
  })
})
