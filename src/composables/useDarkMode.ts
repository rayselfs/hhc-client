import { useDark, useToggle } from '@vueuse/core'
import { watch } from 'vue'
import { useTheme } from 'vuetify'

export function useDarkMode() {
  const theme = useTheme()
  const isDark = useDark({
    storageKey: 'bible-client-theme',
    valueDark: 'dark',
    valueLight: 'light',
  })

  const toggleDark = useToggle(isDark)

  const updateVuetifyTheme = () => {
    theme.change(isDark.value ? 'dark' : 'light')
  }

  // Initialize the theme
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
