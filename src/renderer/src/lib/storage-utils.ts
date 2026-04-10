import { toast } from '@heroui/react'
import i18n from '@renderer/i18n'

export function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    toast.warning(i18n.t('toast.storageSaveFailed'))
  }
}
