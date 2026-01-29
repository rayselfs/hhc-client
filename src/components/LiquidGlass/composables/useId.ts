// ============================================
// Unique ID Generator
// Safe alternative to Math.random() for IDs
// ============================================

let idCounter = 0

/**
 * Generate a unique ID for use in components
 * @param prefix Optional prefix for the ID
 * @returns Unique ID string
 */
export function useId(prefix = 'liquid'): string {
  return `${prefix}-${++idCounter}-${Date.now().toString(36)}`
}

/**
 * Reset the ID counter (for testing purposes only)
 */
export function resetIdCounter(): void {
  idCounter = 0
}
