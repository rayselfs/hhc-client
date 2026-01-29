// ============================================
// Liquid Glass Theme Application
// CSS generation and injection logic
// ============================================

import type {
  LiquidGlassTheme,
  ThemeDefinition,
  ThemeColors,
  GradientColors,
  GlassVariables,
  ComponentVariables,
} from './types'
import { defaultTheme, staticVariables } from './defaults'

let injected = false
let styleElement: HTMLStyleElement | null = null

/**
 * 深度合併兩個物件
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target } as T
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      ;(result as Record<string, unknown>)[key] = source[key]
    }
  }
  return result
}

/**
 * 合併使用者自訂主題與預設主題
 */
export function mergeTheme(
  custom: Partial<LiquidGlassTheme> | undefined,
  defaults: LiquidGlassTheme = defaultTheme
): LiquidGlassTheme {
  if (!custom) return defaults

  return {
    dark: {
      colors: deepMerge(defaults.dark.colors ?? {}, custom.dark?.colors ?? {}),
      gradients: deepMerge(defaults.dark.gradients ?? {}, custom.dark?.gradients ?? {}),
      glass: deepMerge(defaults.dark.glass ?? {}, custom.dark?.glass ?? {}),
      components: deepMerge(defaults.dark.components ?? {}, custom.dark?.components ?? {}),
    },
    light: {
      colors: deepMerge(defaults.light.colors ?? {}, custom.light?.colors ?? {}),
      gradients: deepMerge(defaults.light.gradients ?? {}, custom.light?.gradients ?? {}),
      glass: deepMerge(defaults.light.glass ?? {}, custom.light?.glass ?? {}),
      components: deepMerge(defaults.light.components ?? {}, custom.light?.components ?? {}),
    },
  }
}

/**
 * 生成顏色相關的 CSS 變數
 */
function generateColorVariables(colors: ThemeColors): string[] {
  const lines: string[] = []
  if (colors.primary) lines.push(`--hhc-theme-primary: ${colors.primary};`)
  if (colors.secondary) lines.push(`--hhc-theme-secondary: ${colors.secondary};`)
  if (colors.success) lines.push(`--hhc-theme-success: ${colors.success};`)
  if (colors.error) lines.push(`--hhc-theme-error: ${colors.error};`)
  if (colors.warning) lines.push(`--hhc-theme-warning: ${colors.warning};`)
  if (colors.info) lines.push(`--hhc-theme-info: ${colors.info};`)
  return lines
}

/**
 * 生成漸層相關的 CSS 變數
 */
function generateGradientVariables(gradients: GradientColors): string[] {
  const lines: string[] = []
  if (gradients.primaryStart) lines.push(`--hhc-gradient-primary-start: ${gradients.primaryStart};`)
  if (gradients.primaryEnd) lines.push(`--hhc-gradient-primary-end: ${gradients.primaryEnd};`)
  if (gradients.secondaryStart)
    lines.push(`--hhc-gradient-secondary-start: ${gradients.secondaryStart};`)
  if (gradients.secondaryEnd)
    lines.push(`--hhc-gradient-secondary-end: ${gradients.secondaryEnd};`)
  if (gradients.successStart)
    lines.push(`--hhc-gradient-success-start: ${gradients.successStart};`)
  if (gradients.successEnd) lines.push(`--hhc-gradient-success-end: ${gradients.successEnd};`)
  if (gradients.errorStart) lines.push(`--hhc-gradient-error-start: ${gradients.errorStart};`)
  if (gradients.errorEnd) lines.push(`--hhc-gradient-error-end: ${gradients.errorEnd};`)
  if (gradients.warningStart)
    lines.push(`--hhc-gradient-warning-start: ${gradients.warningStart};`)
  if (gradients.warningEnd) lines.push(`--hhc-gradient-warning-end: ${gradients.warningEnd};`)
  if (gradients.infoStart) lines.push(`--hhc-gradient-info-start: ${gradients.infoStart};`)
  if (gradients.infoEnd) lines.push(`--hhc-gradient-info-end: ${gradients.infoEnd};`)
  return lines
}

/**
 * 生成 Glass 效果相關的 CSS 變數
 */
function generateGlassVariables(glass: GlassVariables): string[] {
  const lines: string[] = []

  // Text
  if (glass.text) lines.push(`--hhc-glass-text: ${glass.text};`)
  if (glass.textOpacity != null) lines.push(`--hhc-glass-text-opacity: ${glass.textOpacity};`)
  if (glass.textMuted) lines.push(`--hhc-glass-text-muted: ${glass.textMuted};`)
  if (glass.textMutedOpacity != null)
    lines.push(`--hhc-glass-text-muted-opacity: ${glass.textMutedOpacity};`)
  if (glass.textDisabledOpacity != null)
    lines.push(`--hhc-glass-text-disabled-opacity: ${glass.textDisabledOpacity};`)

  // Tint
  if (glass.tint) lines.push(`--hhc-glass-tint: ${glass.tint};`)
  if (glass.tintOpacity != null) lines.push(`--hhc-glass-tint-opacity: ${glass.tintOpacity};`)
  if (glass.tintHoverOpacity != null)
    lines.push(`--hhc-glass-tint-hover-opacity: ${glass.tintHoverOpacity};`)
  if (glass.tintActiveOpacity != null)
    lines.push(`--hhc-glass-tint-active-opacity: ${glass.tintActiveOpacity};`)

  // Tint Dark
  if (glass.tintDark) lines.push(`--hhc-glass-tint-dark: ${glass.tintDark};`)
  if (glass.tintDarkOpacity != null)
    lines.push(`--hhc-glass-tint-dark-opacity: ${glass.tintDarkOpacity};`)

  // Simple Bg
  if (glass.simpleBg) lines.push(`--hhc-glass-simple-bg: ${glass.simpleBg};`)
  if (glass.simpleBgOpacity != null)
    lines.push(`--hhc-glass-simple-bg-opacity: ${glass.simpleBgOpacity};`)

  // Border
  if (glass.border) lines.push(`--hhc-glass-border: ${glass.border};`)
  if (glass.borderOpacity != null)
    lines.push(`--hhc-glass-border-opacity: ${glass.borderOpacity};`)
  if (glass.borderHoverOpacity != null)
    lines.push(`--hhc-glass-border-hover-opacity: ${glass.borderHoverOpacity};`)

  // Shine
  if (glass.shineTop) lines.push(`--hhc-glass-shine-top: ${glass.shineTop};`)
  if (glass.shineTopOpacity != null)
    lines.push(`--hhc-glass-shine-top-opacity: ${glass.shineTopOpacity};`)
  if (glass.shineBottom) lines.push(`--hhc-glass-shine-bottom: ${glass.shineBottom};`)
  if (glass.shineBottomOpacity != null)
    lines.push(`--hhc-glass-shine-bottom-opacity: ${glass.shineBottomOpacity};`)
  if (glass.shadowColor) lines.push(`--hhc-glass-shadow-color: ${glass.shadowColor};`)
  if (glass.shadowOpacity != null)
    lines.push(`--hhc-glass-shadow-opacity: ${glass.shadowOpacity};`)
  if (glass.glowOpacity != null) lines.push(`--hhc-glass-glow-opacity: ${glass.glowOpacity};`)

  return lines
}

/**
 * 生成元件特定的 CSS 變數
 */
function generateComponentVariables(components: ComponentVariables): string[] {
  const lines: string[] = []

  if (components.btnSolidOpacity != null)
    lines.push(`--hhc-btn-solid-opacity: ${components.btnSolidOpacity};`)
  if (components.btnTintedOpacity != null)
    lines.push(`--hhc-btn-tinted-opacity: ${components.btnTintedOpacity};`)
  if (components.switchTrackTint)
    lines.push(`--hhc-switch-track-tint: ${components.switchTrackTint};`)
  if (components.switchThumb) lines.push(`--hhc-switch-thumb: ${components.switchThumb};`)
  if (components.progressBgOpacity != null)
    lines.push(`--hhc-progress-bg-opacity: ${components.progressBgOpacity};`)
  if (components.scrollbarThumb)
    lines.push(`--hhc-scrollbar-thumb: ${components.scrollbarThumb};`)
  if (components.scrollbarThumbOpacity != null)
    lines.push(`--hhc-scrollbar-thumb-opacity: ${components.scrollbarThumbOpacity};`)

  return lines
}

/**
 * 生成靜態 CSS 變數（不隨主題變化）
 */
function generateStaticVariables(): string[] {
  return [
    `--hhc-blur-sm: ${staticVariables.blurSm};`,
    `--hhc-blur-md: ${staticVariables.blurMd};`,
    `--hhc-blur-lg: ${staticVariables.blurLg};`,
    `--hhc-blur-xl: ${staticVariables.blurXl};`,
    `--hhc-glass-saturate: ${staticVariables.glassSaturate};`,
    `--hhc-radius-sm: ${staticVariables.radiusSm};`,
    `--hhc-radius-md: ${staticVariables.radiusMd};`,
    `--hhc-radius-lg: ${staticVariables.radiusLg};`,
    `--hhc-radius-xl: ${staticVariables.radiusXl};`,
    `--hhc-radius-pill: ${staticVariables.radiusPill};`,
    `--hhc-transition-fast: ${staticVariables.transitionFast};`,
    `--hhc-transition-normal: ${staticVariables.transitionNormal};`,
    `--hhc-transition-slow: ${staticVariables.transitionSlow};`,
    `--hhc-transition-easing: ${staticVariables.transitionEasing};`,
  ]
}

/**
 * 將 ThemeDefinition 轉換為 CSS 變數字串
 */
function generateCSSVariables(theme: ThemeDefinition): string {
  const lines: string[] = []

  if (theme.colors) lines.push(...generateColorVariables(theme.colors))
  if (theme.gradients) lines.push(...generateGradientVariables(theme.gradients))
  if (theme.glass) lines.push(...generateGlassVariables(theme.glass))
  if (theme.components) lines.push(...generateComponentVariables(theme.components))

  return lines.join('\n  ')
}

/**
 * 生成完整的主題 CSS
 */
export function generateThemeCSS(customTheme?: Partial<LiquidGlassTheme>): string {
  const theme = mergeTheme(customTheme)

  const staticVars = generateStaticVariables().join('\n  ')
  const darkVars = generateCSSVariables(theme.dark)
  const lightVars = generateCSSVariables(theme.light)

  return `
/* Liquid Glass Theme - Auto Generated */
:root {
  /* Static Variables */
  ${staticVars}

  /* Dark Mode (Default) */
  ${darkVars}
}

/* Light Mode - via data-theme attribute */
:root[data-theme='light'] {
  ${lightVars}
}

/* Light Mode - via system preference (fallback) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    ${lightVars}
  }
}
`.trim()
}

/**
 * 將主題 CSS 注入到 document
 */
export function applyTheme(customTheme?: Partial<LiquidGlassTheme>): void {
  if (typeof document === 'undefined') {
    return
  }

  const css = generateThemeCSS(customTheme)

  if (injected && styleElement) {
    // 更新現有的 style element
    styleElement.textContent = css
  } else {
    // 創建新的 style element
    styleElement = document.createElement('style')
    styleElement.id = 'liquid-glass-theme'
    styleElement.textContent = css
    document.head.appendChild(styleElement)
    injected = true
  }
}

/**
 * 檢查主題是否已注入
 */
export function isThemeApplied(): boolean {
  return injected
}

/**
 * 移除已注入的主題（用於測試或清理）
 */
export function removeTheme(): void {
  if (styleElement && styleElement.parentNode) {
    styleElement.parentNode.removeChild(styleElement)
    styleElement = null
    injected = false
  }
}
