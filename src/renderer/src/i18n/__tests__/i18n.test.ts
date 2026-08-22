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

  it('keeps locale keys in sync', () => {
    function flatten(value: unknown, prefix = ''): string[] {
      if (typeof value !== 'object' || value === null) return [prefix]
      return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key)
      )
    }

    const enKeys = flatten(i18n.getResourceBundle('en', 'translation')).sort()
    expect(flatten(i18n.getResourceBundle('zh-TW', 'translation')).sort()).toEqual(enKeys)
    expect(flatten(i18n.getResourceBundle('zh-CN', 'translation')).sort()).toEqual(enKeys)
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

  it('translates Recovery accessibility and Web upload errors in English and Traditional Chinese', () => {
    expect(i18n.t('recovery.indicatorLabel', { lng: 'en', count: 2 })).toBe('2 recovery issues')
    expect(i18n.t('recovery.indicatorLabel', { lng: 'zh-TW', count: 2 })).toBe('2 個修復問題')
    expect(i18n.t('recovery.unavailable', { lng: 'en' })).toBe('Recovery status unavailable')
    expect(i18n.t('recovery.unavailable', { lng: 'zh-TW' })).toBe('無法取得修復狀態')
    expect(i18n.t('recovery.unavailable', { lng: 'zh-CN' })).toBe('无法获取修复状态')
    expect(i18n.t('fileExplorer.uploadFileTooLarge', { lng: 'en', name: 'video.mp4' })).toBe(
      'File "video.mp4" exceeds 2GB limit'
    )
    expect(i18n.t('fileExplorer.uploadFileTooLarge', { lng: 'zh-TW', name: 'video.mp4' })).toBe(
      '檔案「video.mp4」超過 2GB 上限'
    )
    expect(i18n.t('fileExplorer.uploadInsufficientBrowserStorage', { lng: 'en' })).toBe(
      'The selected files exceed available browser storage'
    )
    expect(i18n.t('fileExplorer.uploadInsufficientBrowserStorage', { lng: 'zh-TW' })).toBe(
      '所選檔案超過瀏覽器可用儲存空間'
    )
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
