import type { ContentMessageTuple, ProjectionOwner } from '@renderer/contexts/ProjectionContext'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleStore } from '@renderer/stores/bible'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import type { ServiceCue } from '@renderer/stores/service-playlist'
import { useSlidesStore } from '@renderer/stores/slides'
import { isPresentable } from '@renderer/lib/presentability'
import { isFileItem, type FileItemRecord } from '@shared/types/folder'

export type ServiceCueProjectionStatus =
  | 'projected'
  | 'missing-source'
  | 'unsupported'
  | 'not-ready'
  | 'not-implemented'

export interface ServiceCueProjectionResult {
  status: ServiceCueProjectionStatus
  reason?: string
}

interface ProjectServiceCueDependencies {
  startProjection: (
    owner: ProjectionOwner,
    payloads?: ContentMessageTuple[] | undefined
  ) => Promise<void>
  getFileItem?: (id: string) => FileItemRecord | undefined
  startMediaPresentation?: MediaProjectionStart
}

type MediaProjectionStart = MediaProjectionStoreStartPresentationWithReadiness

type MediaProjectionStoreStartPresentationWithReadiness = ReturnType<
  typeof useMediaProjectionStore.getState
>['startPresentationWithReadiness']

function getDefaultFileItem(id: string): FileItemRecord | undefined {
  const item = useFileExplorerStore.getState().items[id]
  return item && isFileItem(item) ? item : undefined
}

function getDefaultMediaProjectionStart(): MediaProjectionStart {
  return useMediaProjectionStore.getState().startPresentationWithReadiness
}

async function projectMediaCue(
  cue: Extract<ServiceCue, { type: 'media' }>,
  deps: ProjectServiceCueDependencies
): Promise<ServiceCueProjectionResult> {
  const item = (deps.getFileItem ?? getDefaultFileItem)(cue.fileItemId)
  if (!item) return { status: 'missing-source' }
  if (!isPresentable(item.mimeType)) return { status: 'unsupported' }

  const startMediaPresentation = deps.startMediaPresentation ?? getDefaultMediaProjectionStart()
  const report = await startMediaPresentation([item], 0, { prioritizeStartItem: true })
  const itemReadiness = report.items.find((entry) => entry.itemId === item.id)
  if (!itemReadiness || itemReadiness.status !== 'ready') {
    return {
      status: itemReadiness?.status === 'unsupported' ? 'unsupported' : 'not-ready',
      reason: itemReadiness?.reason
    }
  }
  return { status: 'projected' }
}

async function projectBibleCue(
  cue: Extract<ServiceCue, { type: 'bible' }>,
  deps: ProjectServiceCueDependencies
): Promise<ServiceCueProjectionResult> {
  const settings = useBibleSettingsStore.getState()
  const versionId = settings.selectedVersionId
  const bible = useBibleStore.getState()
  const targetVerse = cue.verse ?? 1

  if (!bible.content.has(versionId)) {
    await bible.fetchVersionContent(versionId)
  }

  const updatedBible = useBibleStore.getState()
  const books = updatedBible.content.get(versionId)
  const book = books?.find((candidate) => candidate.number === cue.bookNumber)
  const chapter = book?.chapters.find((candidate) => candidate.number === cue.chapter)
  const verse = chapter?.verses.find((candidate) => candidate.number === targetVerse)

  if (!book || !chapter || !verse) return { status: 'missing-source' }

  const version = updatedBible.versions.find((candidate) => candidate.id === versionId)
  updatedBible.navigateTo({
    bookNumber: cue.bookNumber,
    chapter: cue.chapter,
    verse: targetVerse
  })

  await deps.startProjection('bible', [
    ['bible:settings', { fontSize: settings.fontSize }],
    [
      'bible:chapter',
      {
        bookNumber: cue.bookNumber,
        chapter: cue.chapter,
        chapterVerses: chapter.verses.map((item) => ({ number: item.number, text: item.text })),
        currentVerse: targetVerse,
        versionLocale: version?.locale
      }
    ]
  ])
  return { status: 'projected' }
}

async function projectSlideCue(
  cue: Extract<ServiceCue, { type: 'slide' }>,
  deps: ProjectServiceCueDependencies
): Promise<ServiceCueProjectionResult> {
  const document = useSlidesStore.getState().documents[cue.documentId]
  const slideIndex = document?.slides.findIndex((slide) => slide.id === cue.slideId) ?? -1
  if (!document || slideIndex < 0) return { status: 'missing-source' }

  await deps.startProjection('slide', [['slide:show', { document, slideIndex }]])
  return { status: 'projected' }
}

export async function projectServiceCue(
  cue: ServiceCue,
  deps: ProjectServiceCueDependencies
): Promise<ServiceCueProjectionResult> {
  switch (cue.type) {
    case 'media':
      return projectMediaCue(cue, deps)
    case 'bible':
      return projectBibleCue(cue, deps)
    case 'timer':
      await deps.startProjection('timer')
      return { status: 'projected' }
    case 'slide':
      return projectSlideCue(cue, deps)
    case 'placeholder':
      return { status: 'not-implemented' }
  }
}
