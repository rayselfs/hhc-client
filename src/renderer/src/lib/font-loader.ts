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

export async function loadPresentationFont(family: string): Promise<void> {
  if (family === 'Noto Sans TC Variable') await loadLanguageFont('zh-TW')
  if (family === 'Noto Sans SC Variable') await loadLanguageFont('zh-CN')
  await document.fonts?.load(`16px ${JSON.stringify(family)}`)
}
