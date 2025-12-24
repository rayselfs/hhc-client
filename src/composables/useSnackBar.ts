import { ref } from 'vue'

// SnackBar State Management
const snackbarVisible = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('info')
const snackbarTimeout = ref(5000)
const snackbarLocation = ref('bottom')

// Default SnackBar Config
const defaultConfig = {
  variant: 'tonal' as const,
  location: 'bottom' as const,
  timeout: 5000,
}

// Show SnackBar function
const showSnackBar = (
  text: string,
  color: string = 'info',
  timeout: number = 5000,
  location: string = 'bottom',
) => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbarTimeout.value = timeout
  snackbarLocation.value = location
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
