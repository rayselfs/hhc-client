import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BibleQueueTab } from '../BibleQueueTab'
import { useBibleLiveQueueStore } from '@renderer/stores/bible-live-queue'

const { mockStartProjection, mockProjectBibleQueueItem } = vi.hoisted(() => ({
  mockStartProjection: vi.fn(),
  mockProjectBibleQueueItem: vi.fn(() => Promise.resolve(true))
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    startProjection: mockStartProjection
  })
}))

vi.mock('@renderer/lib/bible-queue-projection', () => ({
  projectBibleQueueItem: mockProjectBibleQueueItem
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'bible.queue.empty': 'No queued verses',
          'bible.queue.description': 'Prepare verses',
          'bible.queue.clear': 'Clear queue',
          'bible.queue.project': 'Project queued verse',
          'bible.queue.remove': 'Remove from queue',
          'bible.queue.current': 'Current',
          'bible.queue.next': 'Next'
        }
        return map[key] ?? key
      }
    })
  }
})

describe('BibleQueueTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
    useBibleLiveQueueStore.getState().clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders empty queue state', () => {
    render(<BibleQueueTab />)
    expect(screen.getByText('No queued verses')).toBeInTheDocument()
  })

  it('projects a queued verse', async () => {
    useBibleLiveQueueStore.getState().addItem({
      versionId: 1,
      bookNumber: 43,
      chapter: 3,
      verse: 16,
      text: 'For God so loved the world',
      reference: 'John 3:16'
    })
    const onProjected = vi.fn()

    render(<BibleQueueTab onProjected={onProjected} />)

    fireEvent.click(screen.getByLabelText('Project queued verse'))

    await waitFor(() => {
      expect(mockProjectBibleQueueItem).toHaveBeenCalled()
      expect(onProjected).toHaveBeenCalledWith({ bookNumber: 43, chapter: 3, verse: 16 })
    })
  })
})
