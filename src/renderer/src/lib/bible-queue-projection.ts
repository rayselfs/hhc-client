import type { ContentMessageTuple, ProjectionOwner } from '@renderer/contexts/ProjectionContext'
import { getBibleProjectionSettingsPayload } from '@renderer/lib/bible-projection-settings'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleStore } from '@renderer/stores/bible'
import { startBibleProjection } from '@renderer/lib/projection-actions'
import type { BibleQueueItem } from '@renderer/stores/bible-live-queue'

interface ProjectBibleQueueItemDependencies {
  startProjection: (owner: ProjectionOwner, payloads?: ContentMessageTuple[]) => Promise<void>
}

export async function projectBibleQueueItem(
  item: BibleQueueItem,
  deps: ProjectBibleQueueItemDependencies
): Promise<boolean> {
  const bible = useBibleStore.getState()
  const settings = useBibleSettingsStore.getState()
  const targetVersionId = bible.versions.some((version) => version.id === item.versionId)
    ? item.versionId
    : settings.selectedVersionId

  if (targetVersionId !== settings.selectedVersionId) {
    settings.setSelectedVersionId(targetVersionId)
  }

  if (!bible.content.has(targetVersionId)) {
    await bible.fetchVersionContent(targetVersionId)
  }

  const updatedBible = useBibleStore.getState()
  const books = updatedBible.content.get(targetVersionId)
  const book = books?.find((candidate) => candidate.number === item.bookNumber)
  const chapter = book?.chapters.find((candidate) => candidate.number === item.chapter)
  const verse = chapter?.verses.find((candidate) => candidate.number === item.verse)
  const version = updatedBible.versions.find((candidate) => candidate.id === targetVersionId)

  if (!book || !chapter || !verse) return false

  updatedBible.navigateTo({
    bookNumber: item.bookNumber,
    chapter: item.chapter,
    verse: item.verse
  })

  const payloads = [
    ['bible:settings', getBibleProjectionSettingsPayload()],
    [
      'bible:chapter',
      {
        bookNumber: item.bookNumber,
        chapter: item.chapter,
        chapterVerses: chapter.verses.map((candidate) => ({
          number: candidate.number,
          text: candidate.text
        })),
        currentVerse: item.verse,
        versionLocale: version?.locale
      }
    ]
  ] satisfies ContentMessageTuple[]
  await startBibleProjection(payloads, deps)

  return true
}
