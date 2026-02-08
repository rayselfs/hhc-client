/**
 * 性能優化工具類
 * 提供防抖動、節流、緩存等功能
 */

/**
 * 防抖動函數
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number,
  immediate = false,
): (...args: Parameters<T>) => void {
  let timeout: number | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      if (!immediate) func(...args)
    }

    const callNow = immediate && !timeout

    if (timeout) clearTimeout(timeout)
    timeout = window.setTimeout(later, wait)

    if (callNow) func(...args)
  }
}

/**
 * 節流函數
 */
export function throttle<T extends (...args: never[]) => unknown>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 緩存管理器
 */
class CacheManager {
  private cache = new Map<string, { value: unknown; expiry: number }>()
  private maxSize = 100
  private defaultTTL = 5 * 60 * 1000 // 5分鐘

  set(key: string, value: unknown, ttl = this.defaultTTL): void {
    // 如果緩存已滿，清理最舊的項目
    if (this.cache.size >= this.maxSize) {
      this.cleanup()
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl,
    })
  }

  get(key: string): unknown | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())

    // 刪除過期的項目
    entries.forEach(([key, item]) => {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    })

    // 如果還是太滿，刪除最舊的項目
    if (this.cache.size >= this.maxSize) {
      const sortedEntries = entries
        .filter(([key]) => this.cache.has(key))
        .sort((a, b) => a[1].expiry - b[1].expiry)

      const toDelete = Math.floor(this.maxSize * 0.2)
      for (let i = 0; i < toDelete && i < sortedEntries.length; i++) {
        const entry = sortedEntries[i]
        if (entry) {
          this.cache.delete(entry[0])
        }
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    }
  }
}

export const cacheManager = new CacheManager()

/**
 * 記憶化函數
 */
export function memoize<T extends (...args: never[]) => unknown>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string,
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = func(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as T
}

/**
 * 批量處理工具
 */
export class BatchProcessor<T> {
  private queue: T[] = []
  private processor: (items: T[]) => void
  private batchSize: number
  private delay: number
  private timeout: number | null = null

  constructor(processor: (items: T[]) => void, batchSize = 10, delay = 100) {
    this.processor = processor
    this.batchSize = batchSize
    this.delay = delay
  }

  add(item: T): void {
    this.queue.push(item)

    if (this.queue.length >= this.batchSize) {
      this.flush()
    } else if (!this.timeout) {
      this.timeout = window.setTimeout(() => this.flush(), this.delay)
    }
  }

  flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    if (this.queue.length > 0) {
      const items = [...this.queue]
      this.queue = []
      this.processor(items)
    }
  }

  destroy(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
    this.queue = []
  }
}

/**
 * 性能監控工具
 */
export class PerformanceMonitor {
  private marks = new Map<string, number>()
  private measures: Array<{ name: string; duration: number; timestamp: number }> = []
  private maxMeasures = 100

  mark(name: string): void {
    this.marks.set(name, performance.now())
  }

  measure(name: string, startMark?: string): number {
    const endTime = performance.now()
    const startTime = startMark ? this.marks.get(startMark) : 0

    if (startTime === undefined) {
      console.warn(`Start mark "${startMark}" not found`)
      return 0
    }

    const duration = endTime - startTime
    this.measures.push({ name, duration, timestamp: Date.now() })

    // 限制測量記錄數量
    if (this.measures.length > this.maxMeasures) {
      this.measures = this.measures.slice(-this.maxMeasures)
    }

    return duration
  }

  getMeasures(name?: string) {
    return name ? this.measures.filter((m) => m.name === name) : this.measures
  }

  getAverageDuration(name: string): number {
    const measures = this.getMeasures(name)
    if (measures.length === 0) return 0

    const total = measures.reduce((sum, m) => sum + m.duration, 0)
    return total / measures.length
  }

  clear(): void {
    this.marks.clear()
    this.measures = []
  }
}

export const performanceMonitor = new PerformanceMonitor()
