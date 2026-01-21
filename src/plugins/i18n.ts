import { createI18n } from 'vue-i18n'
import en from '../locales/en.json'
import zhTW from '../locales/zh-TW.json'
import zhCN from '../locales/zh-CN.json'

const DEFAULT_LOCALE = 'en'

export default createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  globalInjection: true,
  warnHtmlMessage: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    'zh-TW': zhTW,
    'zh-CN': zhCN,
    en: en,
  },
})
