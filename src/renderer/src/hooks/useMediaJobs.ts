import { useCallback, useEffect, useState } from 'react'
import { listMediaJobs, subscribeMediaJobs, type MediaJobRecord } from '@renderer/lib/media-work-db'

export function useMediaJobs(): {
  jobs: MediaJobRecord[]
  refresh: () => Promise<void>
} {
  const [jobs, setJobs] = useState<MediaJobRecord[]>([])

  const refresh = useCallback(async (): Promise<void> => {
    const next = await listMediaJobs()
    setJobs(next.sort((left, right) => right.updatedAt - left.updatedAt))
  }, [])

  useEffect(() => {
    let cancelled = false
    const update = (): void => {
      void listMediaJobs().then((next) => {
        if (!cancelled) setJobs(next.sort((left, right) => right.updatedAt - left.updatedAt))
      })
    }
    update()
    const unsubscribe = subscribeMediaJobs(update)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return { jobs, refresh }
}
