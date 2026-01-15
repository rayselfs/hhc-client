import { ref } from 'vue'

// SnackBar State Management
const snackbarVisible = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('')
const snackbarTimeout = ref(5000)
const snackbarLocation = ref('bottom')

// Default SnackBar Config
const defaultConfig = {
  variant: 'elevated' as const,
  location: 'bottom' as const,
  timeout: 5000,
}

export interface SnackBarOptions {
  color?: string
  timeout?: number
  location?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top left'
    | 'top right'
    | 'bottom left'
    | 'bottom right'
    | string
}

// Show SnackBar function
const showSnackBar = (
  text: string,
  arg2?: string | SnackBarOptions,
  arg3?: number,
  arg4?: string,
) => {
  snackbarText.value = text

  if (typeof arg2 === 'object' && arg2 !== null) {
    const options = arg2 as SnackBarOptions
    snackbarColor.value = options.color ?? ''
    snackbarTimeout.value = options.timeout ?? 5000
    snackbarLocation.value = options.location ?? 'bottom'
  } else {
    snackbarColor.value = (arg2 as string) ?? ''
    snackbarTimeout.value = arg3 ?? 5000
    snackbarLocation.value = arg4 ?? 'bottom'
  }

  snackbarVisible.value = true
}

// Hide SnackBar function
const hideSnackBar = () => {
  snackbarVisible.value = false
}

// Export composable
export function useSnackBar() {
  return {
    snackbarVisible,
    snackbarText,
    snackbarColor,
    snackbarTimeout,
    snackbarLocation,
    defaultConfig,

    showSnackBar,
    hideSnackBar,
  }
}

// Export global functions
export { showSnackBar, hideSnackBar }
