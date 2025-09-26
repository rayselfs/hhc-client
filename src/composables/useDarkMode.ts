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

  // 監聽主題變化並更新 Vuetify
  const updateVuetifyTheme = () => {
    theme.change(isDark.value ? 'dark' : 'light')
  }

  // 初始化時設置主題
  updateVuetifyTheme()

  // 監聽主題變化
  watch(isDark, () => {
    updateVuetifyTheme()
  })

  return {
    isDark,
    toggleDark,
    updateVuetifyTheme,
  }
}
