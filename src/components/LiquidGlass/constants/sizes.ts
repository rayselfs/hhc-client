// ============================================
// Liquid Glass Size Constants
// Unified size scale for all components
// ============================================

/**
 * Size preset names
 */
export type SizeKey = 'x-small' | 'small' | 'default' | 'large' | 'x-large'

/**
 * Size configuration for components
 */
export interface SizeConfig {
  /** Icon size in pixels */
  icon: number
  /** Font size as CSS value */
  fontSize: string
  /** Component height in pixels */
  height: number
  /** Horizontal padding in pixels */
  paddingX: number
}

/**
 * Unified size scale
 * All components should derive their sizes from this scale
 */
export const SIZE_SCALE: Record<SizeKey, SizeConfig> = {
  'x-small': {
    icon: 14,
    fontSize: '0.625rem',
    height: 24,
    paddingX: 8,
  },
  small: {
    icon: 16,
    fontSize: '0.75rem',
    height: 28,
    paddingX: 10,
  },
  default: {
    icon: 18,
    fontSize: '0.875rem',
    height: 36,
    paddingX: 14,
  },
  large: {
    icon: 22,
    fontSize: '1rem',
    height: 44,
    paddingX: 18,
  },
  'x-large': {
    icon: 26,
    fontSize: '1.125rem',
    height: 52,
    paddingX: 22,
  },
} as const

/**
 * Chip size offset (chips are slightly smaller than buttons)
 */
export const CHIP_SIZE_OFFSET = {
  height: -4,
  icon: -2,
} as const

/**
 * Progress bar height by size
 */
export const PROGRESS_HEIGHT: Record<SizeKey, number> = {
  'x-small': 4,
  small: 6,
  default: 8,
  large: 10,
  'x-large': 14,
} as const

/**
 * Check if a value is a valid size key
 */
export function isSizeKey(size: string | number): size is SizeKey {
  return typeof size === 'string' && size in SIZE_SCALE
}

/**
 * Get size config for a size key or calculate from number
 * @param size Size key or pixel value
 * @returns Size configuration
 */
export function getSizeConfig(size: SizeKey | number): SizeConfig {
  if (isSizeKey(size)) {
    return SIZE_SCALE[size]
  }

  // Calculate proportional sizes for numeric input
  const baseSize = SIZE_SCALE.default
  const ratio = size / baseSize.height

  return {
    icon: Math.round(baseSize.icon * ratio),
    fontSize: `${(0.875 * ratio).toFixed(3)}rem`,
    height: size,
    paddingX: Math.round(baseSize.paddingX * ratio),
  }
}

/**
 * Get chip size config (with offset applied)
 * @param size Size key or pixel value
 * @returns Size configuration for chip
 */
export function getChipSizeConfig(size: SizeKey | number): SizeConfig {
  const config = getSizeConfig(size)
  return {
    ...config,
    height: config.height + CHIP_SIZE_OFFSET.height,
    icon: config.icon + CHIP_SIZE_OFFSET.icon,
  }
}

/**
 * Button-specific size configuration
 */
export interface ButtonSizeConfig extends SizeConfig {
  padding: string
  iconPadding: string
}

/**
 * Get button size config with padding
 */
export function getButtonSizeConfig(size: SizeKey | number): ButtonSizeConfig {
  const config = getSizeConfig(size)
  return {
    ...config,
    padding: `0 ${config.paddingX}px`,
    iconPadding: `0 ${Math.round(config.paddingX * 0.6)}px`,
  }
}

/**
 * Get progress bar height by size
 */
export function getProgressHeight(size: SizeKey): number {
  return PROGRESS_HEIGHT[size]
}
