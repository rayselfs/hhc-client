// ============================================
// Liquid Glass Theme Type Definitions
// ============================================

/**
 * RGB 格式字串，例如 '59, 130, 246'
 * 用於 CSS rgba() 函數: rgba(var(--color), 0.5)
 */
export type RGBString = string

/**
 * 主題顏色定義
 */
export interface ThemeColors {
  primary?: RGBString
  secondary?: RGBString
  success?: RGBString
  error?: RGBString
  warning?: RGBString
  info?: RGBString
}

/**
 * 漸層顏色定義（用於 LiquidTimerRing）
 */
export interface GradientColors {
  primaryStart?: RGBString
  primaryEnd?: RGBString
  secondaryStart?: RGBString
  secondaryEnd?: RGBString
  successStart?: RGBString
  successEnd?: RGBString
  errorStart?: RGBString
  errorEnd?: RGBString
  warningStart?: RGBString
  warningEnd?: RGBString
  infoStart?: RGBString
  infoEnd?: RGBString
}

/**
 * Glass 效果相關變數
 */
export interface GlassVariables {
  // 文字
  text?: RGBString
  textOpacity?: number
  textMuted?: RGBString
  textMutedOpacity?: number
  textDisabledOpacity?: number

  // 背景 Tint
  tint?: RGBString
  tintOpacity?: number
  tintHoverOpacity?: number
  tintActiveOpacity?: number

  // Tint Dark (for containers)
  tintDark?: RGBString
  tintDarkOpacity?: number

  // Simple Mode Background
  simpleBg?: RGBString
  simpleBgOpacity?: number

  // 邊框
  border?: RGBString
  borderOpacity?: number
  borderHoverOpacity?: number

  // 光澤效果
  shineTop?: RGBString
  shineTopOpacity?: number
  shineBottom?: RGBString
  shineBottomOpacity?: number
  shadowColor?: RGBString
  shadowOpacity?: number
  glowOpacity?: number
}

/**
 * 元件特定變數
 */
export interface ComponentVariables {
  // Button
  btnSolidOpacity?: number
  btnTintedOpacity?: number

  // Switch
  switchTrackTint?: RGBString
  switchThumb?: RGBString

  // Progress
  progressBgOpacity?: number

  // Scrollbar
  scrollbarThumb?: RGBString
  scrollbarThumbOpacity?: number
}

/**
 * 單一主題定義（dark 或 light）
 */
export interface ThemeDefinition {
  colors?: ThemeColors
  gradients?: GradientColors
  glass?: GlassVariables
  components?: ComponentVariables
}

/**
 * 完整主題配置
 */
export interface LiquidGlassTheme {
  dark: ThemeDefinition
  light: ThemeDefinition
}

/**
 * 主題模式
 */
export type ThemeMode = 'dark' | 'light'
