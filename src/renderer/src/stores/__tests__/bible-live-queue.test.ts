import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBibleLiveQueueStore } from '../bible-live-queue'

describe('bible live queue store', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002')
    useBibleLiveQueueStore.getState().clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds queued verses and sets the first item as current', () => {
    const id = useBibleLiveQueueStore.getState().addItem({
      versionId: 1,
      bookNumber: 43,
      chapter: 3,
      verse: 16,
      text: 'For God so loved the world',
      reference: 'John 3:16'
    })

    expect(id).toBe('00000000-0000-4000-8000-000000000001')
    expect(useBibleLiveQueueStore.getState().currentItemId).toBe(
      '00000000-0000-4000-8000-000000000001'
    )
    expect(useBibleLiveQueueStore.getState().items).toHaveLength(1)
  })

  it('returns the next queued item after the current item', () => {
    useBibleLiveQueueStore.getState().addItem({
      versionId: 1,
      bookNumber: 43,
      chapter: 3,
      verse: 16,
      text: 'For God so loved the world',
      reference: 'John 3:16'
    })
    useBibleLiveQueueStore.getState().addItem({
      versionId: 1,
      bookNumber: 43,
      chapter: 3,
      verse: 17,
      text: 'For God sent not his Son',
      reference: 'John 3:17'
    })

    expect(useBibleLiveQueueStore.getState().nextItem()?.id).toBe(
      '00000000-0000-4000-8000-000000000002'
    )
  })
})
