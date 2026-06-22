import { beforeEach, describe, expect, it, vi } from 'vitest'
import { projectServiceCue } from '../service-cue-runner'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleStore } from '@renderer/stores/bible'
import { useSlidesStore } from '@renderer/stores/slides'
import type { ServiceCue } from '@renderer/stores/service-playlist'
import type { FileItemRecord } from '@shared/types/folder'

function makeFile(id: string, mimeType = 'video/mp4'): FileItemRecord {
  return {
    id,
    parentId: 'root',
    type: 'file',
    sortIndex: 0,
    createdAt: 0,
    expiresAt: null,
    name: `${id}.mp4`,
    url: `blob:${id}`,
    size: 100,
    mimeType
  }
}

describe('projectServiceCue', () => {
  beforeEach(() => {
    useSlidesStore.getState().clear()
    useBibleSettingsStore.setState({
      selectedVersionId: 1,
      fontSize: 88,
      scriptureDisplayMode: 'full-screen',
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
  })

  it('starts timer projection for timer cues', async () => {
    const startProjection = vi.fn(() => Promise.resolve())
    const cue: ServiceCue = {
      id: 'timer-cue',
      type: 'timer',
      title: 'Timer',
      mode: 'timer',
      notes: '',
      completed: false,
      createdAt: 0,
      updatedAt: 0
    }

    await expect(projectServiceCue(cue, { startProjection })).resolves.toEqual({
      status: 'projected'
    })
    expect(startProjection).toHaveBeenCalledWith(
      'timer',
      expect.arrayContaining([['timer:tick', expect.objectContaining({ mode: 'timer' })]])
    )
  })

  it('starts media presentation for media cues', async () => {
    const startProjection = vi.fn(() => Promise.resolve())
    const file = makeFile('file-1')
    const startMediaPresentation = vi.fn(() =>
      Promise.resolve({
        summary: { ready: 1, preparing: 0, unsupported: 0, missing: 0, failed: 0 },
        items: [
          {
            itemId: file.id,
            blobId: file.id,
            status: 'ready' as const,
            reason: 'ready',
            support: 'native' as const
          }
        ]
      })
    )
    const cue: ServiceCue = {
      id: 'media-cue',
      type: 'media',
      title: 'Video',
      fileItemId: file.id,
      fileName: file.name,
      notes: '',
      completed: false,
      createdAt: 0,
      updatedAt: 0
    }

    await expect(
      projectServiceCue(cue, {
        startProjection,
        getFileItem: () => file,
        startMediaPresentation
      })
    ).resolves.toEqual({ status: 'projected' })
    expect(startMediaPresentation).toHaveBeenCalledWith([file], 0, {
      prioritizeStartItem: true
    })
    expect(startProjection).not.toHaveBeenCalled()
  })

  it('projects bible chapter payload for bible cues', async () => {
    const startProjection = vi.fn(() => Promise.resolve())
    const cue: ServiceCue = {
      id: 'bible-cue',
      type: 'bible',
      title: 'John 3:16',
      bookNumber: 43,
      chapter: 3,
      verse: 16,
      reference: 'John 3:16',
      notes: '',
      completed: false,
      createdAt: 0,
      updatedAt: 0
    }

    await expect(projectServiceCue(cue, { startProjection })).resolves.toEqual({
      status: 'projected'
    })
    expect(startProjection).toHaveBeenCalledWith('bible', [
      [
        'bible:settings',
        expect.objectContaining({
          fontSize: 88,
          displayMode: 'full-screen'
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
  })

  it('projects native slide cues', async () => {
    const documentId = useSlidesStore.getState().createDocument('Sunday Deck')
    const document = useSlidesStore.getState().documents[documentId]
    const slideId = document.slides[0]?.id
    if (!slideId) throw new Error('Expected slide')
    const startProjection = vi.fn(() => Promise.resolve())
    const cue: ServiceCue = {
      id: 'slide-cue',
      type: 'slide',
      title: 'Welcome',
      documentId,
      slideId,
      documentTitle: 'Sunday Deck',
      slideTitle: 'Welcome',
      notes: '',
      completed: false,
      createdAt: 0,
      updatedAt: 0
    }

    await expect(projectServiceCue(cue, { startProjection })).resolves.toEqual({
      status: 'projected'
    })
    expect(startProjection).toHaveBeenCalledWith('slide', [
      ['slide:show', { document, slideIndex: 0 }]
    ])
  })
})
