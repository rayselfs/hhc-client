import { useDark, useToggle } from '@vueuse/core'
import { watch } from 'vue'
import { useTheme } from 'vuetify'
import { setTheme, initThemeBridge } from '@/components/LiquidGlass/composables/useThemeBridge'

export function useDarkMode() {
  const theme = useTheme()
  const isDark = useDark({
    storageKey: 'bible-client-theme',
    valueDark: 'dark',
    valueLight: 'light',
  })

  const toggleDark = useToggle(isDark)

  const updateVuetifyTheme = () => {
    const themeMode = isDark.value ? 'dark' : 'light'
    theme.change(themeMode)
    // Bridge to LiquidGlass theme system
    setTheme(themeMode)
  }

  // Initialize theme bridge and the theme
  initThemeBridge(isDark.value ? 'dark' : 'light')
  updateVuetifyTheme()

  // Listen for theme changes
  watch(isDark, () => {
    updateVuetifyTheme()
  })

  return {
    isDark,
    toggleDark,
    updateVuetifyTheme,
  }
}
