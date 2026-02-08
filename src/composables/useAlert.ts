import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSentry } from '@/composables/useSentry'

export interface AlertOptions {
  title?: string
  message: string
  icon?: string
  iconColor?: string
  confirmButtonText?: string
  confirmButtonColor?: string
  cancelButtonText?: string
  cancelButtonColor?: string
  showCancelButton?: boolean
  maxWidth?: string | number
  showDontShowAgain?: boolean
  alertId?: string
}

interface AlertState extends AlertOptions {
  show: boolean
  resolve?: (value: boolean) => void
}

const alertState = ref<AlertState>({
  show: false,
  message: '',
})

// Store alert IDs for which the user selected "Don't show again"
const suppressedAlerts = new Set<string>()

// Load suppressed alerts from localStorage
const loadSuppressedAlerts = () => {
  try {
    const stored = localStorage.getItem('suppressedAlerts')
    if (stored) {
      const parsed = JSON.parse(stored)
      parsed.forEach((id: string) => suppressedAlerts.add(id))
    }
  } catch (error) {
    const { reportError } = useSentry()
    reportError(error, {
      operation: 'load-suppressed-alerts',
      component: 'useAlert',
    })
  }
}

// Save suppressed alerts to localStorage
const saveSuppressedAlerts = () => {
  try {
    localStorage.setItem('suppressedAlerts', JSON.stringify(Array.from(suppressedAlerts)))
  } catch (error) {
    const { reportError } = useSentry()
    reportError(error, {
      operation: 'save-suppressed-alerts',
      component: 'useAlert',
    })
  }
}

// Load on initialization
loadSuppressedAlerts()

export function useAlert() {
  const { t } = useI18n()

  const showAlert = (options: AlertOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      // If alertId exists and is suppressed, return false immediately
      if (options.alertId && suppressedAlerts.has(options.alertId)) {
        resolve(false)
        return
      }

      alertState.value = {
        ...options,
        show: true,
        resolve,
      }
    })
  }

  const confirm = () => {
    if (alertState.value.resolve) {
      alertState.value.resolve(true)
    }
    alertState.value.show = false
  }

  const cancel = () => {
    if (alertState.value.resolve) {
      alertState.value.resolve(false)
    }
    alertState.value.show = false
  }

  const handleDontShowAgain = (alertId: string) => {
    suppressedAlerts.add(alertId)
    saveSuppressedAlerts()
  }

  // Convenience methods
  const alert = (message: string, title?: string, options?: Partial<AlertOptions>) => {
    return showAlert({
      message,
      title: title || t('alert.info'),
      icon: 'mdi-information',
      iconColor: 'info',
      ...options,
    })
  }

  const confirmDialog = (message: string, title?: string, options?: Partial<AlertOptions>) => {
    return showAlert({
      message,
      title,
      icon: 'mdi-help-circle',
      iconColor: 'warning',
      showCancelButton: true,
      ...options,
    })
  }

  const success = (message: string, title?: string, options?: Partial<AlertOptions>) => {
    return showAlert({
      message,
      title: title || t('alert.success'),
      icon: 'mdi-check-circle',
      iconColor: 'success',
      ...options,
    })
  }

  const error = (message: string, title?: string, options?: Partial<AlertOptions>) => {
    return showAlert({
      message,
      title: title || t('alert.error'),
      icon: 'mdi-alert-circle',
      iconColor: 'error',
      ...options,
    })
  }

  const warning = (message: string, title?: string, options?: Partial<AlertOptions>) => {
    return showAlert({
      message,
      title: title || t('alert.warning'),
      icon: 'mdi-alert',
      iconColor: 'warning',
      ...options,
    })
  }

  return {
    alertState,
    showAlert,
    confirm,
    cancel,
    handleDontShowAgain,
    alert,
    confirmDialog,
    success,
    error,
    warning,
  }
}
