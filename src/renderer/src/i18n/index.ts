import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import zhTW from '../locales/zh-TW.json'
import zhCN from '../locales/zh-CN.json'

export const LANGUAGE_STORAGE_KEY = 'hhc-language'

function detectLanguage(): string {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (saved && ['en', 'zh-TW', 'zh-CN'].includes(saved)) return saved

  const nav = navigator.language
  if (nav === 'zh-TW') return 'zh-TW'
  if (nav === 'zh-Hant') return 'zh-TW'
  if (nav.startsWith('zh')) return 'zh-CN'
  if (nav.startsWith('en')) return 'en'
  return 'en'
}

function setHtmlLang(lng: string): void {
  document.documentElement.lang = lng
}

const initialLanguage = detectLanguage()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-TW': { translation: zhTW },
    'zh-CN': { translation: zhCN }
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  useSuspense: false
} as Parameters<typeof i18n.init>[0])

setHtmlLang(initialLanguage)

i18n.on('languageChanged', (lng: string) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  setHtmlLang(lng)
})

export default i18n
