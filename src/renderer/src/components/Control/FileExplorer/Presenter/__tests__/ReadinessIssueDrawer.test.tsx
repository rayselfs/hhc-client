import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReadinessIssueDrawer from '../ReadinessIssueDrawer'
import { listMediaJobs } from '@renderer/lib/media-work-db'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import type { PresentationReadinessReport } from '@renderer/lib/presentation-readiness'

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key })
  }
})

vi.mock('@renderer/lib/media-work-db', () => ({ listMediaJobs: vi.fn() }))
vi.mock('@renderer/lib/media-job-queue', () => ({
  mediaJobQueue: { retry: vi.fn(), setPriority: vi.fn() }
}))

const report: PresentationReadinessReport = {
  summary: { ready: 1, preparing: 1, unsupported: 1, missing: 0, failed: 0 },
  items: [
    {
      itemId: 'video-1',
      blobId: 'video-1',
      status: 'preparing',
      reason: 'metadata-building',
      support: 'native'
    },
    {
      itemId: 'legacy-1',
      blobId: 'legacy-1',
      status: 'unsupported',
      reason: 'unsupported-media',
      support: null
    }
  ]
}

describe('ReadinessIssueDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listMediaJobs).mockResolvedValue([
      {
        id: 'job-1',
        itemId: 'video-1',
        type: 'video-poster',
        priority: 0,
        status: 'failed',
        attempt: 1,
        createdAt: 1,
        updatedAt: 2
      }
    ])
  })

  it('shows per-item reasons and retries the authoritative background job', async () => {
    const user = userEvent.setup()
    render(<ReadinessIssueDrawer report={report} onClose={vi.fn()} />)

    expect(screen.getByText(/metadata-building/)).toBeInTheDocument()
    expect(screen.getByText(/unsupported-media/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Retry/i }))

    expect(mediaJobQueue.retry).toHaveBeenCalledWith('job-1')
  })

  it('keeps the item inspectable until the operator explicitly skips it', async () => {
    const user = userEvent.setup()
    render(<ReadinessIssueDrawer report={report} onClose={vi.fn()} />)

    const skipButtons = screen.getAllByRole('button', { name: /Skip/i })
    await user.click(skipButtons[0])

    expect(screen.queryByText(/metadata-building/)).not.toBeInTheDocument()
    expect(screen.getByText(/unsupported-media/)).toBeInTheDocument()
  })
})
