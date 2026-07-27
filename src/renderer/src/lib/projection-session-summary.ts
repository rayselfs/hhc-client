import type { ProjectionRecoveryState } from './projection-session-coordinator'

export type NowProjectingStatus =
  | 'closed'
  | 'opening'
  | 'connected'
  | 'projecting'
  | 'degraded'
  | 'failed'

interface NowProjectingStatusInput {
  recovery: ProjectionRecoveryState
  isProjectionOpen: boolean
  hasSnapshot: boolean
  isBlackout: boolean
  skippedMediaCount: number
}

export function deriveNowProjectingStatus({
  recovery,
  isProjectionOpen,
  hasSnapshot,
  isBlackout,
  skippedMediaCount
}: NowProjectingStatusInput): NowProjectingStatus {
  if (recovery.status === 'failed') return 'failed'
  if (recovery.status === 'opening' || recovery.status === 'recovering') return 'opening'
  if (!isProjectionOpen) return 'closed'
  if (recovery.status !== 'ready') return 'connected'
  if (skippedMediaCount > 0) return 'degraded'
  if (hasSnapshot && !isBlackout) return 'projecting'
  return 'connected'
}
