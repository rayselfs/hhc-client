import { createStorageKey } from '@renderer/lib/utils'

const ONBOARDED_KEY = createStorageKey('onboarded')

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true'
  } catch {
    return false
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'true')
  } catch {
    console.warn('[Onboarding] Failed to persist onboarded flag')
  }
}

export { ONBOARDED_KEY }
