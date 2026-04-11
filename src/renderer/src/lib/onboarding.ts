import { createKey } from '@renderer/lib/storage-prefix'

const ONBOARDED_KEY = createKey('onboarded')

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
