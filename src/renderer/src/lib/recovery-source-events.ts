export const RECOVERY_SOURCE_CHANGED_EVENT = 'hhc:recovery-source-changed'

export function dispatchRecoverySourceChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RECOVERY_SOURCE_CHANGED_EVENT))
  }
}
