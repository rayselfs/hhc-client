import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BackgroundTaskTray from '../BackgroundTaskTray'
import { useMediaJobs } from '@renderer/hooks/useMediaJobs'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import type { MediaJobRecord } from '@renderer/lib/media-work-db'

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string, values?: { count?: number }) =>
        fallback?.replace('{{count}}', String(values?.count ?? '')) ?? _key
    })
  }
})

vi.mock('@renderer/hooks/useMediaJobs', () => ({ useMediaJobs: vi.fn() }))

vi.mock('@renderer/lib/media-job-queue', () => ({
  mediaJobQueue: {
    pause: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn()
  }
}))

const runningJob: MediaJobRecord = {
  id: 'job-1',
  type: 'video-poster',
  priority: 0,
  status: 'running',
  progress: 42,
  attempt: 1,
  createdAt: 1,
  updatedAt: 2
}

describe('BackgroundTaskTray', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMediaJobs).mockReturnValue({ jobs: [runningJob], refresh: vi.fn() })
  })

  it('keeps active work visible and exposes pause and cancel actions', async () => {
    const user = userEvent.setup()
    render(<BackgroundTaskTray />)

    expect(screen.getByText('1 active')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Background tasks/i }))
    await user.click(screen.getByRole('button', { name: 'Pause task' }))
    await user.click(screen.getByRole('button', { name: 'Cancel task' }))

    expect(mediaJobQueue.pause).toHaveBeenCalledWith('job-1')
    expect(mediaJobQueue.cancel).toHaveBeenCalledWith('job-1')
  })

  it('offers retry for failed work without creating a second incident state', async () => {
    const user = userEvent.setup()
    vi.mocked(useMediaJobs).mockReturnValue({
      jobs: [{ ...runningJob, status: 'failed', errorCode: 'decode-failed' }],
      refresh: vi.fn()
    })
    render(<BackgroundTaskTray />)

    await user.click(screen.getByRole('button', { name: /Background tasks/i }))
    await user.click(screen.getByRole('button', { name: 'Retry task' }))

    expect(mediaJobQueue.retry).toHaveBeenCalledWith('job-1')
  })

  it.each([
    ['running', '1 active'],
    ['failed', '1 need attention']
  ] as const)('counts %s work beyond the 30 visible rows', (status, expected) => {
    const completedJobs = Array.from({ length: 30 }, (_, index) => ({
      ...runningJob,
      id: `completed-${index}`,
      status: 'completed' as const
    }))
    vi.mocked(useMediaJobs).mockReturnValue({
      jobs: [...completedJobs, { ...runningJob, id: 'older-job', status }],
      refresh: vi.fn()
    })

    render(<BackgroundTaskTray />)

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})
