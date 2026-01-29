// ============================================
// Liquid Glass Default Theme Values
// Single source of truth for all CSS variables
// ============================================

import type { LiquidGlassTheme } from './types'

/**
 * 預設主題配置
 * 包含 dark mode 和 light mode 的所有 CSS 變數值
 */
export const defaultTheme: LiquidGlassTheme = {
  // ------------------------------------------
  // Dark Mode (預設)
  // ------------------------------------------
  dark: {
    colors: {
      primary: '10, 132, 255', // Apple Blue
      secondary: '139, 92, 246',
      success: '34, 197, 94',
      error: '239, 68, 68',
      warning: '245, 158, 11',
      info: '14, 165, 233',
    },
    gradients: {
      primaryStart: '99, 160, 255',
      primaryEnd: '10, 132, 255',
      secondaryStart: '167, 139, 250',
      secondaryEnd: '139, 92, 246',
      successStart: '74, 222, 128',
      successEnd: '34, 197, 94',
      errorStart: '248, 113, 113',
      errorEnd: '239, 68, 68',
      warningStart: '251, 191, 36',
      warningEnd: '245, 158, 11',
      infoStart: '56, 189, 248',
      infoEnd: '14, 165, 233',
    },
    glass: {
      text: '255, 255, 255',
      textOpacity: 0.9,
      textMuted: '255, 255, 255',
      textMutedOpacity: 0.6,
      textDisabledOpacity: 0.4,

      tint: '120, 120, 120',
      tintOpacity: 0.18,
      tintHoverOpacity: 0.25,
      tintActiveOpacity: 0.32,

      tintDark: '60, 60, 60',
      tintDarkOpacity: 0.4,

      simpleBg: '20, 20, 20',
      simpleBgOpacity: 0.75,

      border: '255, 255, 255',
      borderOpacity: 0.15,
      borderHoverOpacity: 0.25,

      shineTop: '255, 255, 255',
      shineTopOpacity: 0.2,
      shineBottom: '0, 0, 0',
      shineBottomOpacity: 0.08,
      shadowColor: '0, 0, 0',
      shadowOpacity: 0.12,
      glowOpacity: 0.35,
    },
    components: {
      btnSolidOpacity: 0.55,
      btnTintedOpacity: 0.2,
      switchTrackTint: '120, 120, 120',
      switchThumb: '255, 255, 255',
      progressBgOpacity: 0.1,
      scrollbarThumb: '255, 255, 255',
      scrollbarThumbOpacity: 0.25,
    },
  },

  // ------------------------------------------
  // Light Mode
  // ------------------------------------------
  light: {
    colors: {
      primary: '0, 122, 255', // Apple Blue (Light)
      secondary: '124, 58, 237',
      success: '22, 163, 74',
      error: '220, 38, 38',
      warning: '217, 119, 6',
      info: '2, 132, 199',
    },
    gradients: {
      primaryStart: '96, 165, 250',
      primaryEnd: '0, 122, 255',
      secondaryStart: '167, 139, 250',
      secondaryEnd: '124, 58, 237',
      successStart: '74, 222, 128',
      successEnd: '22, 163, 74',
      errorStart: '248, 113, 113',
      errorEnd: '220, 38, 38',
      warningStart: '251, 191, 36',
      warningEnd: '217, 119, 6',
      infoStart: '56, 189, 248',
      infoEnd: '2, 132, 199',
    },
    glass: {
      text: '30, 30, 30',
      textOpacity: 0.87,
      textMuted: '60, 60, 60',
      textMutedOpacity: 0.6,
      textDisabledOpacity: 0.38,

      tint: '245, 245, 245',
      tintOpacity: 0.5,
      tintHoverOpacity: 0.6,
      tintActiveOpacity: 0.7,

      tintDark: '250, 250, 250',
      tintDarkOpacity: 0.4,

      simpleBg: '245, 245, 245',
      simpleBgOpacity: 0.5,

      border: '0, 0, 0',
      borderOpacity: 0.08,
      borderHoverOpacity: 0.12,

      shineTop: '255, 255, 255',
      shineTopOpacity: 0.4,
      shineBottom: '0, 0, 0',
      shineBottomOpacity: 0.05,
      shadowColor: '0, 0, 0',
      shadowOpacity: 0.08,
      glowOpacity: 0.5,
    },
    components: {
      btnSolidOpacity: 0.65,
      btnTintedOpacity: 0.25,
      switchTrackTint: '180, 180, 180',
      switchThumb: '255, 255, 255',
      progressBgOpacity: 0.15,
      scrollbarThumb: '100, 100, 100',
      scrollbarThumbOpacity: 0.3,
    },
  },
}

/**
 * 靜態 CSS 變數（不隨主題變化）
 */
export const staticVariables = {
  // Backdrop Filter
  blurSm: '8px',
  blurMd: '12px',
  blurLg: '16px',
  blurXl: '20px',
  glassSaturate: '200%',

  // Border Radius
  radiusSm: '4px',
  radiusMd: '8px',
  radiusLg: '12px',
  radiusXl: '16px',
  radiusPill: '9999px',

  // Transitions
  transitionFast: '0.15s',
  transitionNormal: '0.25s',
  transitionSlow: '0.4s',
  transitionEasing: 'cubic-bezier(0.2, 0, 0.2, 1)',
}
