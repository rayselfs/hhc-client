import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
}

interface AlertState extends AlertOptions {
  show: boolean
  resolve?: (value: boolean) => void
}

const alertState = ref<AlertState>({
  show: false,
  message: '',
})

export function useAlert() {
  const { t } = useI18n()

  const showAlert = (options: AlertOptions): Promise<boolean> => {
    return new Promise((resolve) => {
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

  // 便捷方法
  const alert = (message: string, title?: string) => {
    return showAlert({
      message,
      title: title || t('alert.info'),
      icon: 'mdi-information',
      iconColor: 'info',
    })
  }

  const confirmDialog = (message: string, title?: string) => {
    return showAlert({
      message,
      title,
      icon: 'mdi-help-circle',
      iconColor: 'warning',
      showCancelButton: true,
    })
  }

  const success = (message: string, title?: string) => {
    return showAlert({
      message,
      title: title || t('alert.success'),
      icon: 'mdi-check-circle',
      iconColor: 'success',
    })
  }

  const error = (message: string, title?: string) => {
    return showAlert({
      message,
      title: title || t('alert.error'),
      icon: 'mdi-alert-circle',
      iconColor: 'error',
    })
  }

  const warning = (message: string, title?: string) => {
    return showAlert({
      message,
      title: title || t('alert.warning'),
      icon: 'mdi-alert',
      iconColor: 'warning',
    })
  }

  return {
    alertState,
    showAlert,
    confirm,
    cancel,
    alert,
    confirmDialog,
    success,
    error,
    warning,
  }
}
