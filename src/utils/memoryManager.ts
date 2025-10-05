/**
 * 記憶體管理工具類
 * 用於追蹤和清理記憶體洩漏
 */

interface MemoryTracker {
  id: string
  type: 'interval' | 'timeout' | 'listener' | 'observer'
  resource: any
  createdAt: number
  component?: string
}

class MemoryManager {
  private static instance: MemoryManager
  private trackers: Map<string, MemoryTracker> = new Map()
  private maxTrackers = 100

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  /**
   * 追蹤資源
   */
  track(id: string, type: MemoryTracker['type'], resource: any, component?: string): void {
    // 如果已存在，先清理舊的
    if (this.trackers.has(id)) {
      this.untrack(id)
    }

    this.trackers.set(id, {
      id,
      type,
      resource,
      createdAt: Date.now(),
      component,
    })

    // 限制追蹤器數量
    if (this.trackers.size > this.maxTrackers) {
      this.cleanupOldTrackers()
    }
  }

  /**
   * 停止追蹤並清理資源
   */
  untrack(id: string): boolean {
    const tracker = this.trackers.get(id)
    if (!tracker) return false

    try {
      switch (tracker.type) {
        case 'interval':
          clearInterval(tracker.resource)
          break
        case 'timeout':
          clearTimeout(tracker.resource)
          break
        case 'listener':
          if (tracker.resource.element && tracker.resource.event && tracker.resource.handler) {
            tracker.resource.element.removeEventListener(
              tracker.resource.event,
              tracker.resource.handler,
            )
          }
          break
        case 'observer':
          if (tracker.resource.disconnect) {
            tracker.resource.disconnect()
          }
          break
      }
    } catch (error) {
      console.warn(`Failed to cleanup resource ${id}:`, error)
    }

    this.trackers.delete(id)
    return true
  }

  /**
   * 清理所有資源
   */
  cleanupAll(): void {
    const ids = Array.from(this.trackers.keys())
    ids.forEach((id) => this.untrack(id))
  }

  /**
   * 清理特定組件的資源
   */
  cleanupComponent(component: string): void {
    const componentTrackers = Array.from(this.trackers.entries())
      .filter(([_, tracker]) => tracker.component === component)
      .map(([id]) => id)

    componentTrackers.forEach((id) => this.untrack(id))
  }

  /**
   * 清理舊的追蹤器
   */
  private cleanupOldTrackers(): void {
    const sortedTrackers = Array.from(this.trackers.entries()).sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    )

    const toRemove = sortedTrackers.slice(0, Math.floor(this.maxTrackers * 0.2))
    toRemove.forEach(([id]) => this.untrack(id))
  }

  /**
   * 獲取記憶體使用統計
   */
  getStats(): {
    totalTrackers: number
    byType: Record<string, number>
    byComponent: Record<string, number>
  } {
    const byType: Record<string, number> = {}
    const byComponent: Record<string, number> = {}

    this.trackers.forEach((tracker) => {
      byType[tracker.type] = (byType[tracker.type] || 0) + 1
      if (tracker.component) {
        byComponent[tracker.component] = (byComponent[tracker.component] || 0) + 1
      }
    })

    return {
      totalTrackers: this.trackers.size,
      byType,
      byComponent,
    }
  }
}

export const memoryManager = MemoryManager.getInstance()

/**
 * Vue 組合式函數：記憶體管理
 */
export function useMemoryManager(componentName?: string) {
  const track = (id: string, type: MemoryTracker['type'], resource: any) => {
    memoryManager.track(id, type, resource, componentName)
  }

  const untrack = (id: string) => {
    return memoryManager.untrack(id)
  }

  const cleanup = () => {
    if (componentName) {
      memoryManager.cleanupComponent(componentName)
    } else {
      memoryManager.cleanupAll()
    }
  }

  return {
    track,
    untrack,
    cleanup,
    getStats: () => memoryManager.getStats(),
  }
}
