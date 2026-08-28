import { describe, expect, it } from 'vitest'
import { buildMediaJobViewState } from '../media-job-view-state'
import type { MediaJobRecord } from '../media-work-db'

function job(status: MediaJobRecord['status'], updatedAt: number): MediaJobRecord {
  return {
    id: `${status}-${updatedAt}`,
    type: 'cover-thumbnail',
    itemId: 'item-1',
    priority: 0,
    status,
    attempt: 0,
    createdAt: updatedAt,
    updatedAt
  }
}

describe('buildMediaJobViewState', () => {
  it('shows the highest severity unfinished job for an item', () => {
    expect(
      buildMediaJobViewState([job('completed', 4), job('running', 3), job('failed', 2)])
    ).toEqual({ 'item-1': { status: 'failed', progress: undefined } })
  })

  it('omits items whose jobs are all complete', () => {
    expect(buildMediaJobViewState([job('completed', 1), job('cancelled', 2)])).toEqual({})
  })
})
