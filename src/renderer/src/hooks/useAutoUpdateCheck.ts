import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@heroui/react/toast'
import { isElectron } from '@renderer/lib/env'
import { useUpdateStore } from '@renderer/stores/update'

export function useAutoUpdateCheck(): void {
  const { t } = useTranslation()
  const store = useUpdateStore()

  useEffect(() => {
    if (!isElectron()) return

    // Subscribe to status changes from main process
    const unsubscribe = window.api.update.onStatusChanged((data) => {
      if (data.status === 'checking') store.check()
      else if (data.status === 'available' && data.version) {
        store.setAvailable(data.version)
        // Show toast notification when update is available
        toast.success(t('toast.updateAvailable', { version: data.version }))
      } else if (data.status === 'not-available') store.setNotAvailable()
      else if (data.status === 'downloading') store.setDownloading()
      else if (data.status === 'downloaded') store.setDownloaded()
      else if (data.status === 'error') store.setError(data.error ?? 'Unknown error')
    })

    return unsubscribe
  }, []) // empty deps - mount once, store and t are stable
}
