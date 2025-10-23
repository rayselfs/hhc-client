import { ref, computed } from 'vue'

const STORAGE_KEY = 'basic_auth_credentials'

interface AuthCredentials {
  username: string
  password: string
}

const showAuthDialog = ref(false)
const credentials = ref<AuthCredentials | null>(null)

/**
 * useBasicAuth composable
 * 管理 Basic Auth 認證狀態和 localStorage
 */
export function useBasicAuth() {
  /**
   * 從 localStorage 載入儲存的認證資訊
   */
  const loadCredentials = (): AuthCredentials | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as AuthCredentials
      }
    } catch (error) {
      console.error('Failed to load credentials from localStorage:', error)
    }
    return null
  }

  /**
   * 儲存認證資訊到 localStorage
   */
  const saveCredentials = (auth: AuthCredentials) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
      credentials.value = auth
    } catch (error) {
      console.error('Failed to save credentials to localStorage:', error)
    }
  }

  /**
   * 清除儲存的認證資訊
   */
  const clearCredentials = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      credentials.value = null
    } catch (error) {
      console.error('Failed to clear credentials from localStorage:', error)
    }
  }

  /**
   * 取得 Basic Auth Header 值
   */
  const getAuthHeader = (): string | null => {
    const auth = credentials.value || loadCredentials()
    if (auth) {
      const encoded = btoa(`${auth.username}:${auth.password}`)
      return `Basic ${encoded}`
    }
    return null
  }

  /**
   * 檢查是否有儲存的認證資訊
   */
  const hasCredentials = computed(() => {
    return !!credentials.value
  })

  /**
   * 初始化：從 localStorage 載入認證資訊
   */
  const initialize = () => {
    credentials.value = loadCredentials()
  }

  // 初始化載入
  initialize()

  return {
    showAuthDialog,
    credentials,
    hasCredentials,
    loadCredentials,
    saveCredentials,
    clearCredentials,
    getAuthHeader,
  }
}
