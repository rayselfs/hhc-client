import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import i18n, { LANGUAGE_STORAGE_KEY } from '../index'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('i18n configuration', () => {
  it('initializes with default language en and fallback en', () => {
    expect(i18n.language).toBe('en')
    expect(i18n.options.fallbackLng).toEqual(['en'])
  })

  it('loads all 3 locale bundles', () => {
    expect(i18n.getResourceBundle('en', 'translation')).toBeDefined()
    expect(i18n.getResourceBundle('zh-TW', 'translation')).toBeDefined()
    expect(i18n.getResourceBundle('zh-CN', 'translation')).toBeDefined()
  })
})

describe('translations', () => {
  it('translates nav keys correctly across all locales', () => {
    expect(i18n.t('nav.timer', { lng: 'en' })).toBe('TIMER')
    expect(i18n.t('nav.timer', { lng: 'zh-TW' })).toBe('計時器')
    expect(i18n.t('nav.timer', { lng: 'zh-CN' })).toBe('计时器')

    expect(i18n.t('nav.bible', { lng: 'en' })).toBe('BIBLE')
    expect(i18n.t('nav.bible', { lng: 'zh-TW' })).toBe('聖經')
    expect(i18n.t('nav.bible', { lng: 'zh-CN' })).toBe('圣经')
  })

  it('translates page title keys correctly across all locales', () => {
    expect(i18n.t('timer.title', { lng: 'en' })).toBe('TIMER')
    expect(i18n.t('timer.title', { lng: 'zh-TW' })).toBe('計時器')
    expect(i18n.t('timer.title', { lng: 'zh-CN' })).toBe('计时器')

    expect(i18n.t('bible.title', { lng: 'en' })).toBe('BIBLE')
    expect(i18n.t('bible.title', { lng: 'zh-TW' })).toBe('聖經')
    expect(i18n.t('bible.title', { lng: 'zh-CN' })).toBe('圣经')
  })
})

describe('language persistence', () => {
  it('saves language to localStorage on changeLanguage', async () => {
    await i18n.changeLanguage('zh-TW')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-TW')
  })

  it('saves language to localStorage when switching back', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-CN')
    await i18n.changeLanguage('en')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')
  })
})
