import { ref } from 'vue'

// SnackBar 狀態管理
const snackbarVisible = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('info')
const snackbarTimeout = ref(5000)

// 預設的 SnackBar 配置
const defaultConfig = {
  variant: 'tonal' as const,
  location: 'bottom' as const,
  timeout: 5000,
}

// 顯示 SnackBar 的函數
const showSnackBar = (text: string, color: string = 'info', timeout: number = 5000) => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbarTimeout.value = timeout
  snackbarVisible.value = true
}

// 隱藏 SnackBar 的函數
const hideSnackBar = () => {
  snackbarVisible.value = false
}

// 導出 composable
export function useSnackBar() {
  return {
    // 狀態
    snackbarVisible,
    snackbarText,
    snackbarColor,
    snackbarTimeout,

    // 方法
    showSnackBar,
    hideSnackBar,

    // 配置
    defaultConfig,
  }
}

// 導出全域函數
export { showSnackBar, hideSnackBar }
