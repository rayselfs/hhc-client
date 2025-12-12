import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from './useElectron'
import { useLocalStorage } from './useLocalStorage'
import { useSentry } from './useSentry'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'

/**
 * 語系配置接口
 */
interface LocaleConfig {
  value: string
  textKey: string // i18n key (例如: 'settings.chinese')
}

/**
 * 語系配置列表 - 在此處新增語系即可
 * 新增語系時只需在此處添加一個項目
 *
 * 檔案命名建議：
 * - zh-TW.json - 繁體中文（台灣）
 * - zh-CN.json - 簡體中文（中國大陸）
 * - en.json - 英文
 */
const LOCALE_CONFIGS = [
  { value: 'en', textKey: 'settings.english' },
  { value: 'zh-TW', textKey: 'settings.traditionalChinese' },
  { value: 'zh-CN', textKey: 'settings.simplifiedChinese' },
] as const satisfies readonly LocaleConfig[]

/**
 * 從配置中提取支援的語系列表
 */
const SUPPORTED_LOCALES = LOCALE_CONFIGS.map((config) => config.value)
export type SupportedLocale = (typeof LOCALE_CONFIGS)[number]['value']

/**
 * 預設語系（取第一個配置的語系）
 */
const DEFAULT_LOCALE: SupportedLocale = LOCALE_CONFIGS[0]?.value || ('en' as SupportedLocale)

/**
 * 語系選項接口
 */
export interface LanguageOption {
  value: SupportedLocale
  text: string // i18n key
}

/**
 * 將系統語系代碼映射到支援的語系
 * @param systemLocale - 系統語系代碼（例如：'zh-TW', 'zh-CN', 'en-US', 'zh'）
 * @returns 支援的語系代碼
 */
function mapSystemLocaleToSupported(systemLocale: string | undefined): SupportedLocale {
  if (!systemLocale || typeof systemLocale !== 'string') {
    return DEFAULT_LOCALE
  }

  const localeLower = systemLocale.toLowerCase()

  // 1. 先檢查完整的地區代碼是否在支援列表中（例如：'zh-TW', 'zh-CN'）
  if (SUPPORTED_LOCALES.includes(localeLower as SupportedLocale)) {
    return localeLower as SupportedLocale
  }

  // 2. 提取主要語言代碼和地區代碼
  const parts = localeLower.split('-')
  const mainLocale = parts[0]
  const region = parts[1]

  // 3. 檢查主要語言代碼是否在支援列表中（例如：'zh' -> 映射到對應的預設語系）
  if (mainLocale === 'zh') {
    // 根據地區代碼映射
    if (region === 'cn' || region === 'hans') {
      // 簡體中文 -> 檢查是否支援 zh-CN
      if (SUPPORTED_LOCALES.includes('zh-CN' as SupportedLocale)) {
        return 'zh-CN' as SupportedLocale
      }
    } else if (region === 'tw' || region === 'hk' || region === 'hant') {
      // 繁體中文 -> 檢查是否支援 zh-TW
      if (SUPPORTED_LOCALES.includes('zh-TW' as SupportedLocale)) {
        return 'zh-TW' as SupportedLocale
      }
    }
    // 如果只是 'zh'，返回預設語系（通常是 zh-TW）
    return 'zh-TW'
  }

  // 4. 檢查是否在支援列表中（例如：'en' -> 'en'）
  if (SUPPORTED_LOCALES.includes(mainLocale as SupportedLocale)) {
    return mainLocale as SupportedLocale
  }

  // 5. 如果不支援，返回預設語系
  return DEFAULT_LOCALE
}

/**
 * 偵測系統語系
 * @returns 系統語系代碼
 */
export async function detectSystemLocale(): Promise<SupportedLocale> {
  const { isElectron } = useElectron()

  try {
    if (isElectron()) {
      // Electron 環境：使用 app.getLocale()
      const systemLocale = await window.electronAPI.getSystemLocale()
      return mapSystemLocaleToSupported(systemLocale)
    } else {
      // 瀏覽器環境：使用 navigator.language
      let systemLocale: string | undefined = navigator.language
      if (!systemLocale && navigator.languages && navigator.languages.length > 0) {
        systemLocale = navigator.languages[0]
      }
      return mapSystemLocaleToSupported(systemLocale || DEFAULT_LOCALE)
    }
  } catch (error) {
    console.error('Failed to detect system locale:', error)
    return DEFAULT_LOCALE
  }
}

/**
 * 獲取初始語系（優先順序：保存的語系 > 系統語系 > 預設語系）
 * @returns 初始語系代碼
 */
export async function getInitialLocale(): Promise<SupportedLocale> {
  const { getLocalItem } = useLocalStorage()

  // 1. 先檢查是否有保存的語系設定
  const savedLocale = getLocalItem<string>(
    getStorageKey(StorageCategory.APP, StorageKey.PREFERRED_LANGUAGE),
  )

  if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as SupportedLocale)) {
    return savedLocale as SupportedLocale
  }

  // 2. 如果沒有保存的設定，偵測系統語系
  const systemLocale = await detectSystemLocale()
  return systemLocale
}

/**
 * 語系選項列表 - 自動從配置生成
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = LOCALE_CONFIGS.map((config) => ({
  value: config.value as SupportedLocale,
  text: config.textKey,
}))

/**
 * useLocaleDetection composable
 * 提供完整的語系管理功能，包括偵測、選擇和切換
 */
export function useLocaleDetection() {
  const { locale } = useI18n()
  const { isElectron } = useElectron()
  const { getLocalItem, setLocalItem } = useLocalStorage()

  const { reportError } = useSentry()
  const { sendLocaleUpdate } = useProjectionMessaging()

  // 當前選擇的語系
  const selectedLanguage = ref<SupportedLocale>(locale.value as SupportedLocale)

  // 語系選項（computed，可根據需要動態生成）
  const languageOptions = computed<LanguageOption[]>(() => LANGUAGE_OPTIONS)

  /**
   * 應用新的語系設定
   * 統一處理所有語系相關的副作用：
   * 1. 更新 i18n 實例
   * 2. 更新本地狀態
   * 3. 持久化到 localStorage
   * 4. 同步到投影視窗
   * 5. 同步到 Electron 主進程
   */
  const applyLocale = async (newLocale: SupportedLocale) => {
    // 1. 更新 i18n
    locale.value = newLocale

    // 2. 更新本地狀態
    selectedLanguage.value = newLocale

    // 3. 持久化
    const isProjection = window.location.hash.includes('projection')

    if (!isProjection) {
      setLocalItem(getStorageKey(StorageCategory.APP, StorageKey.PREFERRED_LANGUAGE), newLocale)

      // 4. 同步到投影視窗
      sendLocaleUpdate(newLocale)

      // 5. 同步到 Electron 主進程
      if (isElectron()) {
        try {
          await window.electronAPI.updateLanguage(newLocale)
        } catch (error) {
          reportError(error, {
            operation: 'update-language',
            component: 'useLocaleDetection',
            extra: { newLocale },
          })
        }
      }
    }
  }

  /**
   * 初始化語系
   * 優先順序：保存的語系 > 系統語系 > 當前 i18n 語系
   */
  const initializeLanguage = async () => {
    const savedLanguage = getLocalItem<string>(
      getStorageKey(StorageCategory.APP, StorageKey.PREFERRED_LANGUAGE),
    )

    let targetLocale: SupportedLocale

    if (savedLanguage && SUPPORTED_LOCALES.includes(savedLanguage as SupportedLocale)) {
      targetLocale = savedLanguage as SupportedLocale
    } else {
      targetLocale = await getInitialLocale()
    }

    await applyLocale(targetLocale)
  }

  /**
   * 處理語系切換
   * @param newLocale - 新的語系代碼
   */
  const handleLanguageChange = async (newLocale: string) => {
    if (!SUPPORTED_LOCALES.includes(newLocale as SupportedLocale)) {
      console.warn(`Unsupported locale: ${newLocale}`)
      return
    }

    await applyLocale(newLocale as SupportedLocale)
  }

  return {
    selectedLanguage,
    languageOptions,
    initializeLanguage,
    handleLanguageChange,
    // 導出常量供外部使用
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
  }
}
