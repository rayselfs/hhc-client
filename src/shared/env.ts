/**
 * Unified environment detection - single source of truth.
 * Replaces multiple isElectron() implementations across the codebase.
 */

export function isElectron(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).electron !== 'undefined'
}

export function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).electron === 'undefined'
}

export function isDev(): boolean {
  return import.meta.env?.DEV === true
}

export function isTest(): boolean {
  return import.meta.env?.MODE === 'test'
}
