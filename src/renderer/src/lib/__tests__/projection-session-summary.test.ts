import { deriveNowProjectingStatus } from '../projection-session-summary'

describe('deriveNowProjectingStatus', () => {
  it.each([
    {
      name: 'failed recovery wins over every other state',
      recoveryStatus: 'failed' as const,
      isProjectionOpen: true,
      hasSnapshot: true,
      isBlackout: false,
      skippedMediaCount: 2,
      expected: 'failed'
    },
    {
      name: 'opening wins over a missing projection window',
      recoveryStatus: 'opening' as const,
      isProjectionOpen: false,
      hasSnapshot: true,
      isBlackout: false,
      skippedMediaCount: 0,
      expected: 'opening'
    },
    {
      name: 'recovering maps to opening',
      recoveryStatus: 'recovering' as const,
      isProjectionOpen: true,
      hasSnapshot: true,
      isBlackout: false,
      skippedMediaCount: 0,
      expected: 'opening'
    },
    {
      name: 'a missing projection window is closed',
      recoveryStatus: 'ready' as const,
      isProjectionOpen: false,
      hasSnapshot: true,
      isBlackout: false,
      skippedMediaCount: 2,
      expected: 'closed'
    },
    {
      name: 'skipped Media entries make a ready session degraded',
      recoveryStatus: 'ready' as const,
      isProjectionOpen: true,
      hasSnapshot: true,
      isBlackout: false,
      skippedMediaCount: 1,
      expected: 'degraded'
    },
    {
      name: 'visible ready content is projecting',
      recoveryStatus: 'ready' as const,
      isProjectionOpen: true,
      hasSnapshot: true,
      isBlackout: false,
      skippedMediaCount: 0,
      expected: 'projecting'
    },
    {
      name: 'intentional blackout is connected',
      recoveryStatus: 'ready' as const,
      isProjectionOpen: true,
      hasSnapshot: true,
      isBlackout: true,
      skippedMediaCount: 0,
      expected: 'connected'
    },
    {
      name: 'a ready empty window is connected',
      recoveryStatus: 'ready' as const,
      isProjectionOpen: true,
      hasSnapshot: false,
      isBlackout: false,
      skippedMediaCount: 0,
      expected: 'connected'
    }
  ])('$name', ({ recoveryStatus, expected, ...input }) => {
    expect(
      deriveNowProjectingStatus({
        ...input,
        recovery: { status: recoveryStatus, generation: 1, failure: null }
      })
    ).toBe(expected)
  })
})
