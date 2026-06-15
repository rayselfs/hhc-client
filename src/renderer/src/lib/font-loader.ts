const loadedLanguages = new Set<string>()

export async function loadLanguageFont(language: string): Promise<void> {
  const normalizedLanguage = language === 'zh-CN' ? 'zh-CN' : language === 'zh-TW' ? 'zh-TW' : 'en'
  if (loadedLanguages.has(normalizedLanguage)) return

  loadedLanguages.add(normalizedLanguage)
  try {
    if (normalizedLanguage === 'zh-CN') {
      await import('@fontsource-variable/noto-sans-sc/index.css')
    } else if (normalizedLanguage === 'zh-TW') {
      await import('@fontsource-variable/noto-sans-tc/index.css')
    }
  } catch (error) {
    loadedLanguages.delete(normalizedLanguage)
    console.error(`Failed to load font for ${normalizedLanguage}:`, error)
  }
}
