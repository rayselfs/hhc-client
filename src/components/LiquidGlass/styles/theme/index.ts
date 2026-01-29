// ============================================
// Liquid Glass Theme Module
// ============================================

// Types
export type {
  RGBString,
  ThemeColors,
  GradientColors,
  GlassVariables,
  ComponentVariables,
  ThemeDefinition,
  LiquidGlassTheme,
  ThemeMode,
} from './types'

// Defaults
export { defaultTheme, staticVariables } from './defaults'

// Application
export {
  mergeTheme,
  generateThemeCSS,
  applyTheme,
  isThemeApplied,
  removeTheme,
} from './apply'
