type DeferredCleanup = () => Promise<void> | void

const lockCounts = new Map<string, number>()
const deferredCleanups = new Map<string, Set<DeferredCleanup>>()

async function runDeferredCleanups(resourceId: string): Promise<void> {
  const cleanups = deferredCleanups.get(resourceId)
  if (!cleanups) return
  deferredCleanups.delete(resourceId)
  await Promise.allSettled([...cleanups].map((cleanup) => cleanup()))
}

export function isMediaResourceLocked(resourceId: string): boolean {
  return (lockCounts.get(resourceId) ?? 0) > 0
}

export function lockMediaResources(resourceIds: Iterable<string>): () => void {
  const lockedIds = [...new Set(resourceIds)]
  for (const resourceId of lockedIds) {
    lockCounts.set(resourceId, (lockCounts.get(resourceId) ?? 0) + 1)
  }

  let released = false
  return () => {
    if (released) return
    released = true
    for (const resourceId of lockedIds) {
      const nextCount = (lockCounts.get(resourceId) ?? 1) - 1
      if (nextCount > 0) {
        lockCounts.set(resourceId, nextCount)
        continue
      }
      lockCounts.delete(resourceId)
      void runDeferredCleanups(resourceId)
    }
  }
}

export function deferMediaResourceCleanup(resourceId: string, cleanup: DeferredCleanup): boolean {
  if (!isMediaResourceLocked(resourceId)) return false
  const cleanups = deferredCleanups.get(resourceId) ?? new Set<DeferredCleanup>()
  cleanups.add(cleanup)
  deferredCleanups.set(resourceId, cleanups)
  return true
}

export function resetMediaResourceLocksForTests(): void {
  lockCounts.clear()
  deferredCleanups.clear()
}
