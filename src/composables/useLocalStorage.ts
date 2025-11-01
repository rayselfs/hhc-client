interface UseStorageReturn {
  getLocalItem: <T>(key: string, format?: 'int' | 'float' | 'boolean' | 'array' | 'object') => T
  setLocalItem: <T>(key: string, value: T, format?: 'array' | 'object') => void
  removeLocalItem: (key: string) => void
  clear: () => void
}

export function useLocalStorage(): UseStorageReturn {
  return {
    getLocalItem,
    setLocalItem,
    removeLocalItem,
    clear,
  }
}

function getLocalItem<T>(
  key: string,
  format?: 'int' | 'float' | 'boolean' | 'array' | 'object',
): T {
  if (!format) {
    return localStorage.getItem(key) as T
  }
  switch (format) {
    case 'int':
      return parseInt(localStorage.getItem(key) || '0') as T
    case 'float':
      return parseFloat(localStorage.getItem(key) || '0') as T
    case 'boolean':
      return (localStorage.getItem(key) === 'true') as T
    case 'array':
      return (localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key) || '[]') : []) as T
    case 'object':
      return (localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key) || '{}') : {}) as T
    default:
      return localStorage.getItem(key) as T
  }
}

function setLocalItem<T>(key: string, value: T, format?: 'array' | 'object'): void {
  if (!format) {
    localStorage.setItem(key, String(value))
    return
  }
  switch (format) {
    case 'array':
      localStorage.setItem(key, JSON.stringify(value))
      break
    case 'object':
      localStorage.setItem(key, JSON.stringify(value))
      break
    default:
      localStorage.setItem(key, String(value))
      break
  }
}

function removeLocalItem(key: string): void {
  localStorage.removeItem(key)
}

function clear(): void {
  localStorage.clear()
}
