import { beforeEach, describe, expect, it, vi } from 'vitest'
import { projectBibleQueueItem } from '../bible-queue-projection'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleProjectionStore } from '@renderer/stores/bible-projection'
import type { BibleQueueItem } from '@renderer/stores/bible-live-queue'

const queueItem: BibleQueueItem = {
  id: 'queue-1',
  versionId: 1,
  bookNumber: 43,
  chapter: 3,
  verse: 16,
  text: 'For God so loved the world',
  reference: 'John 3:16',
  createdAt: 0
}

describe('projectBibleQueueItem', () => {
  beforeEach(() => {
    useBibleSettingsStore.setState({
      selectedVersionId: 1,
      fontSize: 88,
      scriptureDisplayMode: 'lower-third',
      scriptureTemplateId: 'dark-stage'
    })
    useBibleStore.setState({
      versions: [{ id: 1, code: 'kjv', name: 'KJV', locale: 'en', updatedAt: 0 }],
      content: new Map([
        [
          1,
          [
            {
              number: 43,
              code: 'Joh',
              name: 'John',
              abbreviation: 'Jn',
              chapters: [
                {
                  number: 3,
                  verses: [
                    { id: 1, number: 16, text: 'For God so loved the world' },
                    { id: 2, number: 17, text: 'For God sent not his Son' }
                  ]
                }
              ]
            }
          ]
        ]
      ]),
      currentPassage: null
    })
    useBibleProjectionStore.getState().clearLastPayloads()
  })

  it('projects a queued bible item', async () => {
    const startProjection = vi.fn(() => Promise.resolve())

    await expect(projectBibleQueueItem(queueItem, { startProjection })).resolves.toBe(true)

    expect(startProjection).toHaveBeenCalledWith('bible', [
      [
        'bible:settings',
        expect.objectContaining({
          fontSize: 88,
          displayMode: 'lower-third'
        })
      ],
      [
        'bible:chapter',
        {
          bookNumber: 43,
          chapter: 3,
          chapterVerses: [
            { number: 16, text: 'For God so loved the world' },
            { number: 17, text: 'For God sent not his Son' }
          ],
          currentVerse: 16,
          versionLocale: 'en'
        }
      ]
    ])
    expect(useBibleStore.getState().currentPassage).toEqual({
      bookNumber: 43,
      chapter: 3,
      verse: 16
    })
    expect(useBibleProjectionStore.getState().lastPayloads).toEqual([
      [
        'bible:settings',
        expect.objectContaining({
          fontSize: 88,
          displayMode: 'lower-third'
        })
      ],
      [
        'bible:chapter',
        expect.objectContaining({
          bookNumber: 43,
          chapter: 3,
          currentVerse: 16
        })
      ]
    ])
  })
})
