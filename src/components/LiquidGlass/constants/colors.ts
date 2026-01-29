// ============================================
// Liquid Glass Color Constants
// Centralized color definitions
// ============================================

/**
 * Theme color names
 */
export type ThemeColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'

/**
 * CSS variable names for theme colors
 */
export const THEME_COLOR_VARS: Record<ThemeColor, string> = {
  primary: '--hhc-theme-primary',
  secondary: '--hhc-theme-secondary',
  success: '--hhc-theme-success',
  error: '--hhc-theme-error',
  warning: '--hhc-theme-warning',
  info: '--hhc-theme-info',
} as const

/**
 * CSS variable names for gradient colors
 */
export const GRADIENT_COLOR_VARS: Record<ThemeColor, { start: string; end: string }> = {
  primary: {
    start: '--hhc-gradient-primary-start',
    end: '--hhc-gradient-primary-end',
  },
  secondary: {
    start: '--hhc-gradient-secondary-start',
    end: '--hhc-gradient-secondary-end',
  },
  success: {
    start: '--hhc-gradient-success-start',
    end: '--hhc-gradient-success-end',
  },
  error: {
    start: '--hhc-gradient-error-start',
    end: '--hhc-gradient-error-end',
  },
  warning: {
    start: '--hhc-gradient-warning-start',
    end: '--hhc-gradient-warning-end',
  },
  info: {
    start: '--hhc-gradient-info-start',
    end: '--hhc-gradient-info-end',
  },
} as const

/**
 * Check if a color string is a valid theme color name
 */
export function isThemeColor(color: string): color is ThemeColor {
  return color in THEME_COLOR_VARS
}

/**
 * Get CSS variable reference for a theme color
 * @param color Theme color name
 * @returns CSS var() reference, e.g., "var(--hhc-theme-primary)"
 */
export function getThemeColorVar(color: ThemeColor): string {
  return `var(${THEME_COLOR_VARS[color]})`
}

/**
 * Get CSS rgba() expression for a theme color with alpha
 * @param color Theme color name
 * @param alpha Alpha value (0-1)
 * @returns CSS rgba() expression, e.g., "rgba(var(--hhc-theme-primary), 0.5)"
 */
export function getThemeColorAlpha(color: ThemeColor, alpha: number): string {
  return `rgba(var(${THEME_COLOR_VARS[color]}), ${alpha})`
}

/**
 * Get RGB value for a color (for inline styles)
 * @param color Theme color name or CSS color
 * @returns RGB string if theme color, otherwise returns the input
 */
export function getColorRgb(color: string): string {
  if (isThemeColor(color)) {
    return `var(${THEME_COLOR_VARS[color]})`
  }
  return color
}

/**
 * Get gradient CSS variables for a theme color
 * @param color Theme color name
 * @returns Object with start and end CSS var() references
 */
export function getGradientColorVars(color: ThemeColor): { start: string; end: string } {
  const vars = GRADIENT_COLOR_VARS[color]
  return {
    start: `var(${vars.start})`,
    end: `var(${vars.end})`,
  }
}
