import { watch, onMounted, onUnmounted, ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const THEME_ATTRIBUTE = 'data-theme'

/**
 * Theme bridge for LiquidGlass components.
 *
 * This composable provides a decoupled way to handle theming that doesn't
 * depend on any specific UI framework. It uses a `data-theme` attribute
 * on the document element to communicate theme state.
 *
 * Usage:
 * - Call `initThemeBridge()` once at app startup
 * - Call `setTheme('light' | 'dark')` to change theme
 * - Use `useThemeBridge()` in components to react to theme changes
 *
 * Integration with Vuetify (in main.ts or App.vue):
 * ```ts
 * import { useTheme } from 'vuetify'
 * import { setTheme, initThemeBridge } from '@/components/LiquidGlass'
 *
 * initThemeBridge()
 * const theme = useTheme()
 * watch(() => theme.global.current.value.dark, (isDark) => {
 *   setTheme(isDark ? 'dark' : 'light')
 * }, { immediate: true })
 * ```
 */

// Internal state
let isInitialized = false
const currentTheme = ref<ThemeMode>('dark')

/**
 * Initialize the theme bridge.
 * This should be called once at app startup.
 */
export function initThemeBridge(initialTheme?: ThemeMode): void {
  if (isInitialized) return

  // Check for system preference if no initial theme provided
  if (!initialTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    initialTheme = prefersDark ? 'dark' : 'light'
  }

  setTheme(initialTheme)
  isInitialized = true

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    // Only auto-update if no explicit theme has been set
    const currentAttr = document.documentElement.getAttribute(THEME_ATTRIBUTE)
    if (!currentAttr) {
      setTheme(e.matches ? 'dark' : 'light')
    }
  })
}

/**
 * Set the current theme.
 * This updates the `data-theme` attribute on the document element.
 */
export function setTheme(theme: ThemeMode): void {
  currentTheme.value = theme
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme)
}

/**
 * Get the current theme.
 */
export function getTheme(): ThemeMode {
  return currentTheme.value
}

/**
 * Use theme bridge in a component.
 * Returns reactive theme state and utilities.
 */
export function useThemeBridge() {
  const isDark = ref(currentTheme.value === 'dark')

  // Watch for theme attribute changes via MutationObserver
  let observer: MutationObserver | null = null

  const updateFromAttribute = () => {
    const attr = document.documentElement.getAttribute(THEME_ATTRIBUTE)
    if (attr === 'light' || attr === 'dark') {
      currentTheme.value = attr
      isDark.value = attr === 'dark'
    }
  }

  onMounted(() => {
    updateFromAttribute()

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === THEME_ATTRIBUTE
        ) {
          updateFromAttribute()
        }
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTRIBUTE],
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  // Also watch the internal ref
  watch(currentTheme, (newTheme) => {
    isDark.value = newTheme === 'dark'
  })

  return {
    isDark,
    currentTheme,
    setTheme,
    toggleTheme: () => setTheme(currentTheme.value === 'dark' ? 'light' : 'dark'),
  }
}
