import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, ListTodo, Plus, Trash2, ArrowUp, ArrowDown, Eye, Play } from 'lucide-react'
import { useServicePlaylistStore, type ServiceCue } from '@renderer/stores/service-playlist'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import {
  projectServiceCue,
  type ServiceCueProjectionResult
} from '@renderer/lib/service-cue-runner'

type TranslationFn = unknown

function translate(t: TranslationFn, key: string): string {
  return String((t as (key: string) => unknown)(key))
}

function cueTypeLabel(cue: ServiceCue, t: TranslationFn): string {
  switch (cue.type) {
    case 'media':
      return translate(t, 'service.cueTypes.media')
    case 'bible':
      return translate(t, 'service.cueTypes.bible')
    case 'timer':
      return translate(t, 'service.cueTypes.timer')
    case 'placeholder':
      return translate(t, 'service.cueTypes.song')
  }
}

function cueSourceStatus(
  cue: ServiceCue,
  sourceExists: { media: boolean },
  t: TranslationFn
): string | null {
  if (cue.type === 'media' && !sourceExists.media) return translate(t, 'service.missingMediaSource')
  if (cue.type === 'placeholder') return translate(t, 'service.notImplementedYet')
  return null
}

function projectionResultMessage(
  result: ServiceCueProjectionResult,
  t: TranslationFn
): string | null {
  if (result.status === 'projected') return translate(t, 'service.projectionStarted')
  if (result.status === 'missing-source') return translate(t, 'service.projectErrors.missingSource')
  if (result.status === 'unsupported') return translate(t, 'service.projectErrors.unsupported')
  if (result.status === 'not-ready') return translate(t, 'service.projectErrors.notReady')
  if (result.status === 'not-implemented')
    return translate(t, 'service.projectErrors.notImplemented')
  return null
}

export default function ServiceWorkspace(): React.JSX.Element {
  const { t } = useTranslation()
  const { ensureProjectionOpen, startProjection } = useProjection()
  const cues = useServicePlaylistStore((state) => state.cues)
  const currentCueId = useServicePlaylistStore((state) => state.currentCueId)
  const selectedCueId = useServicePlaylistStore((state) => state.selectedCueId)
  const previewCueId = useServicePlaylistStore((state) => state.previewCueId)
  const mediaItems = useFileExplorerStore((state) => state.items)

  const currentCue = useServicePlaylistStore((state) => state.currentCue())
  const nextCue = useServicePlaylistStore((state) => state.nextCue())
  const previewCue = useServicePlaylistStore((state) => state.previewCue())
  const [projectingCueId, setProjectingCueId] = useState<string | null>(null)
  const [projectionMessage, setProjectionMessage] = useState<string | null>(null)

  const actions = useServicePlaylistStore.getState()

  const cueRows = useMemo(
    () =>
      cues.map((cue, index) => ({
        cue,
        index,
        mediaExists: cue.type !== 'media' || Boolean(mediaItems[cue.fileItemId])
      })),
    [cues, mediaItems]
  )

  const addTimerCue = (): void => {
    actions.addCue({
      type: 'timer',
      title: t('service.defaultTimerCue'),
      mode: 'timer'
    })
  }

  const addBibleCue = (): void => {
    actions.addCue({
      type: 'bible',
      title: t('service.defaultBibleCue'),
      bookNumber: 43,
      chapter: 3,
      verse: 16,
      reference: 'John 3:16'
    })
  }

  const addMediaCue = (): void => {
    actions.addCue({
      type: 'media',
      title: t('service.defaultMediaCue'),
      fileItemId: 'missing-media-source',
      fileName: t('service.selectMediaLater')
    })
  }

  const handleProjectCue = async (cue: ServiceCue): Promise<void> => {
    actions.jumpToCue(cue.id)
    setProjectingCueId(cue.id)
    setProjectionMessage(null)
    try {
      const result = await projectServiceCue(cue, { ensureProjectionOpen, startProjection })
      setProjectionMessage(projectionResultMessage(result, t))
    } finally {
      setProjectingCueId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('service.title')}</h1>
          <p className="text-sm text-muted">{t('service.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (currentCue) void handleProjectCue(currentCue)
            }}
            disabled={!currentCue || projectingCueId !== null}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground hover:opacity-90 disabled:opacity-40"
          >
            <Play className="size-4" />
            {projectingCueId ? t('service.projecting') : t('service.projectCurrentCue')}
          </button>
          <button
            type="button"
            onClick={addMediaCue}
            className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-2 text-sm text-foreground hover:opacity-80"
          >
            <Plus className="size-4" />
            {t('service.addMedia')}
          </button>
          <button
            type="button"
            onClick={addBibleCue}
            className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-2 text-sm text-foreground hover:opacity-80"
          >
            <Plus className="size-4" />
            {t('service.addBible')}
          </button>
          <button
            type="button"
            onClick={addTimerCue}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm text-accent-foreground hover:opacity-90"
          >
            <Plus className="size-4" />
            {t('service.addTimer')}
          </button>
        </div>
      </header>
      {projectionMessage && (
        <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          {projectionMessage}
        </div>
      )}

      <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-4 max-xl:grid-cols-1">
        <div className="min-h-0 rounded-3xl bg-surface p-3">
          {cueRows.length === 0 ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center text-muted">
              <ListTodo className="size-10" />
              <div>
                <p className="font-medium text-foreground">{t('service.emptyTitle')}</p>
                <p className="text-sm">{t('service.emptyDescription')}</p>
              </div>
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {cueRows.map(({ cue, index, mediaExists }) => {
                const status = cueSourceStatus(cue, { media: mediaExists }, t)
                const isCurrent = cue.id === currentCueId
                const isSelected = cue.id === selectedCueId
                const isPreview = cue.id === previewCueId
                return (
                  <li
                    key={cue.id}
                    className={`rounded-2xl border p-3 transition ${isCurrent ? 'border-accent bg-accent/10' : isSelected ? 'border-default-400 bg-surface-secondary' : 'border-default-200 bg-background/40'}`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => actions.jumpToCue(cue.id)}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-sm font-semibold"
                        aria-label={t('service.jumpToCue')}
                      >
                        {index + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => actions.selectCue(cue.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase text-muted">
                            {cueTypeLabel(cue, t)}
                          </span>
                          {cue.completed && (
                            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                              {t('service.completed')}
                            </span>
                          )}
                          {isPreview && (
                            <span className="rounded-full bg-default-200 px-2 py-0.5 text-xs text-muted">
                              {t('service.previewing')}
                            </span>
                          )}
                        </div>
                        <p className="truncate font-medium">{cue.title}</p>
                        {status && <p className="text-sm text-warning">{status}</p>}
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <IconButton
                          label={t('service.projectCue')}
                          onClick={() => void handleProjectCue(cue)}
                          disabled={projectingCueId !== null}
                        >
                          <Play className="size-4" />
                        </IconButton>
                        <IconButton
                          label={t('service.previewCue')}
                          onClick={() => actions.previewCueById(cue.id)}
                        >
                          <Eye className="size-4" />
                        </IconButton>
                        <IconButton
                          label={t('service.moveUp')}
                          onClick={() => actions.reorderCue(index, index - 1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="size-4" />
                        </IconButton>
                        <IconButton
                          label={t('service.moveDown')}
                          onClick={() => actions.reorderCue(index, index + 1)}
                          disabled={index === cues.length - 1}
                        >
                          <ArrowDown className="size-4" />
                        </IconButton>
                        <IconButton
                          label={t('service.duplicateCue')}
                          onClick={() => actions.duplicateCue(cue.id)}
                        >
                          <Copy className="size-4" />
                        </IconButton>
                        <IconButton
                          label={t('service.completeCue')}
                          onClick={() => actions.markComplete(cue.id)}
                        >
                          <Check className="size-4" />
                        </IconButton>
                        <IconButton
                          label={t('service.removeCue')}
                          onClick={() => actions.removeCue(cue.id)}
                          danger
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        <aside className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
          <CueSummary title={t('service.currentCue')} cue={currentCue} />
          <CueSummary title={t('service.nextCue')} cue={nextCue} />
          <CueSummary title={t('service.previewCue')} cue={previewCue} />
        </aside>
      </section>
    </div>
  )
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  danger = false
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-8 items-center justify-center rounded-full disabled:opacity-30 ${danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:bg-surface-secondary'}`}
    >
      {children}
    </button>
  )
}

function CueSummary({ title, cue }: { title: string; cue: ServiceCue | null }): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl bg-background/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      {cue ? (
        <>
          <p className="mt-1 font-medium">{cue.title}</p>
          <p className="text-sm text-muted">{cueTypeLabel(cue, t)}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">—</p>
      )}
    </div>
  )
}
