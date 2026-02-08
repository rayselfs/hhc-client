import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from './useElectron'
import { useLocalStorage } from './useLocalStorage'
import { useSentry } from '@/composables/useSentry'

import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import { useProjectionManager } from '@/composables/useProjectionManager'

/**
 * Locale Configuration Interface
 */
interface LocaleConfig {
  value: string
  textKey: string // i18n key (e.g. 'settings.chinese')
}

/**
 * Locale Configuration List - Add new locales here
 * Just add an item here when adding a new locale
 *
 * File naming recommendation:
 * - zh-TW.json - Traditional Chinese (Taiwan)
 * - zh-CN.json - Simplified Chinese (China)
 * - en.json - English
 */
const LOCALE_CONFIGS = [
  { value: 'en', textKey: 'settings.english' },
  { value: 'zh-TW', textKey: 'settings.traditionalChinese' },
  { value: 'zh-CN', textKey: 'settings.simplifiedChinese' },
] as const satisfies readonly LocaleConfig[]

/**
 * Extract supported locale list from configuration
 */
const SUPPORTED_LOCALES = LOCALE_CONFIGS.map((config) => config.value)
export type SupportedLocale = (typeof LOCALE_CONFIGS)[number]['value']

/**
 * Default locale (take the first configured locale)
 */
const DEFAULT_LOCALE: SupportedLocale = LOCALE_CONFIGS[0]?.value || ('en' as SupportedLocale)

/**
 * Language Option Interface
 */
export interface LanguageOption {
  value: SupportedLocale
  text: string // i18n key
}

/**
 * Map system locale code to supported locale
 * @param systemLocale - System locale code (e.g. 'zh-TW', 'zh-CN', 'en-US', 'zh')
 * @returns Supported locale code
 */
function mapSystemLocaleToSupported(systemLocale: string | undefined): SupportedLocale {
  if (!systemLocale || typeof systemLocale !== 'string') {
    return DEFAULT_LOCALE
  }

  const localeLower = systemLocale.toLowerCase()

  // 1. Check if full locale code is in supported list (e.g. 'zh-TW', 'zh-CN')
  if (SUPPORTED_LOCALES.includes(localeLower as SupportedLocale)) {
    return localeLower as SupportedLocale
  }

  // 2. Extract main language code and region code
  const parts = localeLower.split('-')
  const mainLocale = parts[0]
  const region = parts[1]

  // 3. Check if main language code is in supported list (e.g. 'zh' -> map to corresponding default locale)
  if (mainLocale === 'zh') {
    // Map based on region code
    if (region === 'cn' || region === 'hans') {
      // Simplified Chinese -> Check if zh-CN is supported
      if (SUPPORTED_LOCALES.includes('zh-CN' as SupportedLocale)) {
        return 'zh-CN' as SupportedLocale
      }
    } else if (region === 'tw' || region === 'hk' || region === 'hant') {
      // Traditional Chinese -> Check if zh-TW is supported
      if (SUPPORTED_LOCALES.includes('zh-TW' as SupportedLocale)) {
        return 'zh-TW' as SupportedLocale
      }
    }
    // If just 'zh', return default locale (usually zh-TW)
    return 'zh-TW'
  }

  // 4. Check if in supported list (e.g. 'en' -> 'en')
  if (SUPPORTED_LOCALES.includes(mainLocale as SupportedLocale)) {
    return mainLocale as SupportedLocale
  }

  // 5. If not supported, return default locale
  return DEFAULT_LOCALE
}

/**
 * Detect system locale
 * @returns System locale code
 */
export async function detectSystemLocale(): Promise<SupportedLocale> {
  const { isElectron, getSystemLocale } = useElectron()

  try {
    if (isElectron()) {
      // Electron environment: use app.getLocale()
      const systemLocale = await getSystemLocale()
      return mapSystemLocaleToSupported(systemLocale)
    } else {
      // Browser environment: use navigator.language
      let systemLocale: string | undefined = navigator.language
      if (!systemLocale && navigator.languages && navigator.languages.length > 0) {
        systemLocale = navigator.languages[0]
      }
      return mapSystemLocaleToSupported(systemLocale || DEFAULT_LOCALE)
    }
  } catch (error) {
    const { reportError } = useSentry()
    reportError(error, {
      operation: 'detect-system-locale',
      component: 'useLocaleDetection',
    })
    return DEFAULT_LOCALE
  }
}

/**
 * Get initial locale (Priority: Saved locale > System locale > Default locale)
 * @returns Initial locale code
 */
export async function getInitialLocale(): Promise<SupportedLocale> {
  const { getLocalItem } = useLocalStorage()

  // 1. Check if there is a saved locale setting
  const savedLocale = getLocalItem<string>(
    getStorageKey(StorageCategory.APP, StorageKey.PREFERRED_LANGUAGE),
  )

  if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale as SupportedLocale)) {
    return savedLocale as SupportedLocale
  }

  // 2. If no saved setting, detect system locale
  const systemLocale = await detectSystemLocale()
  return systemLocale
}

/**
 * Language option list - Automatically generated from configuration
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = LOCALE_CONFIGS.map((config) => ({
  value: config.value as SupportedLocale,
  text: config.textKey,
}))

/**
 * useLocaleDetection composable
 * Provides complete locale management functions including detection, selection, and switching
 */
export function useLocaleDetection() {
  const { locale } = useI18n()
  const { isElectron, updateLanguage } = useElectron()
  const { getLocalItem, setLocalItem } = useLocalStorage()

  const { sendLocaleUpdate } = useProjectionManager()

  // Currently selected language
  const selectedLanguage = ref<SupportedLocale>(locale.value as SupportedLocale)

  // Language options (computed, can be generated dynamically if needed)
  const languageOptions = computed<LanguageOption[]>(() => LANGUAGE_OPTIONS)

  /**
   * Apply new locale setting
   * Unified handling of all locale-related side effects:
   * 1. Update i18n instance
   * 2. Update local state
   * 3. Persist to localStorage
   * 4. Sync to projection window
   * 5. Sync to Electron main process
   */
  const applyLocale = async (newLocale: SupportedLocale) => {
    // 1. Update i18n
    locale.value = newLocale

    // 2. Update local state
    selectedLanguage.value = newLocale

    // 3. Persist
    const isProjection = window.location.hash.includes('projection')

    if (!isProjection) {
      setLocalItem(getStorageKey(StorageCategory.APP, StorageKey.PREFERRED_LANGUAGE), newLocale)

      // 4. Sync to projection window
      sendLocaleUpdate(newLocale)

      // 5. Sync to Electron main process
      if (isElectron()) {
        await updateLanguage(newLocale)
      }
    }
  }

  /**
   * Initialize locale
   * Priority: Saved locale > System locale > Current i18n locale
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
   * Handle language change
   * @param newLocale - New locale code
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
    // Export constants for external use
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
  }
}
