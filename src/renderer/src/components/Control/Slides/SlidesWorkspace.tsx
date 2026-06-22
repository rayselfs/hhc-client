import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Presentation, Type, Trash2 } from 'lucide-react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useSlidesStore } from '@renderer/stores/slides'
import { BUILT_IN_SLIDE_TEMPLATES } from '@renderer/lib/slide-templates'
import { importPptxSlideDocument } from '@renderer/lib/slide-pptx-import'
import type { SlideDocument, SlideElement, SlideRecord } from '@shared/types/slides'

function getSlideBackgroundColor(slide: SlideRecord): string {
  return slide.background.type === 'color' ? slide.background.color : '#050505'
}

function MiniSlidePreview({
  document,
  slide
}: {
  document: SlideDocument
  slide: SlideRecord
}): React.JSX.Element {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-default-200"
      style={{
        aspectRatio: `${document.size.width} / ${document.size.height}`,
        backgroundColor: getSlideBackgroundColor(slide)
      }}
    >
      {slide.elements.map((element) => (
        <MiniSlideElement key={element.id} element={element} document={document} />
      ))}
    </div>
  )
}

function MiniSlideElement({
  element,
  document
}: {
  element: SlideElement
  document: SlideDocument
}): React.JSX.Element {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${(element.x / document.size.width) * 100}%`,
    top: `${(element.y / document.size.height) * 100}%`,
    width: `${(element.width / document.size.width) * 100}%`,
    height: `${(element.height / document.size.height) * 100}%`,
    opacity: element.opacity,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.zIndex
  }

  if (element.type === 'image') {
    return (
      <div
        className="flex items-center justify-center bg-white/10 text-[10px] text-white/50"
        style={style}
      >
        {element.alt || element.mediaId}
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden whitespace-pre-wrap"
      style={{
        ...style,
        color: element.style.color,
        fontFamily: element.style.fontFamily,
        fontSize: `${Math.max(10, element.style.fontSize * 0.18)}px`,
        fontWeight: element.style.fontWeight,
        lineHeight: element.style.lineHeight,
        textAlign: element.style.align
      }}
    >
      {element.text}
    </div>
  )
}

export default function SlidesWorkspace(): React.JSX.Element {
  const { t } = useTranslation()
  const { startProjection } = useProjection()
  const documents = useSlidesStore((state) => state.documents)
  const currentDocumentId = useSlidesStore((state) => state.currentDocumentId)
  const selectedSlideId = useSlidesStore((state) => state.selectedSlideId)
  const currentDocument = useSlidesStore((state) => state.currentDocument())
  const selectedSlide = useSlidesStore((state) => state.selectedSlide())
  const selectedSlideIndex = useSlidesStore((state) => state.selectedSlideIndex())
  const actions = useSlidesStore.getState()
  const [isProjecting, setIsProjecting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const pptxInputRef = useRef<HTMLInputElement>(null)

  const documentList = Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt)

  const handleCreateDocument = (): void => {
    actions.createDocument(t('slides.defaultDeckTitle'))
  }

  const handleProjectCurrentSlide = async (): Promise<void> => {
    if (!currentDocument || selectedSlideIndex < 0) return
    setIsProjecting(true)
    try {
      await startProjection('slide', [
        ['slide:show', { document: currentDocument, slideIndex: selectedSlideIndex }]
      ])
    } finally {
      setIsProjecting(false)
    }
  }

  const handleImportPptxFile = async (file: File): Promise<void> => {
    setIsImporting(true)
    setImportError(null)
    try {
      const title = file.name.replace(/\.pptx$/i, '') || t('slides.importedDeckTitle')
      const document = await importPptxSlideDocument(await file.arrayBuffer(), { title })
      actions.importDocument(document)
    } catch {
      setImportError(t('slides.importFailed'))
    } finally {
      setIsImporting(false)
      if (pptxInputRef.current) pptxInputRef.current.value = ''
    }
  }

  if (!currentDocument || !selectedSlide || !currentDocumentId || !selectedSlideId) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 text-center">
        <Presentation className="size-12 text-muted" />
        <div>
          <h1 className="text-2xl font-semibold">{t('slides.title')}</h1>
          <p className="text-sm text-muted">{t('slides.emptyDescription')}</p>
        </div>
        <button
          type="button"
          onClick={handleCreateDocument}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-accent-foreground"
        >
          <Plus className="size-4" />
          {t('slides.createDeck')}
        </button>
        <button
          type="button"
          onClick={() => pptxInputRef.current?.click()}
          disabled={isImporting}
          className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-2 disabled:opacity-40"
        >
          <Presentation className="size-4" />
          {isImporting ? t('slides.importing') : t('slides.importPptx')}
        </button>
        <input
          ref={pptxInputRef}
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImportPptxFile(file)
          }}
        />
        {importError && <p className="text-sm text-danger">{importError}</p>}
      </div>
    )
  }

  const textElements = selectedSlide.elements.filter((element) => element.type === 'text')

  return (
    <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)_320px] gap-4 max-2xl:grid-cols-[200px_minmax(0,1fr)] max-xl:grid-cols-1">
      <aside className="flex min-h-0 flex-col gap-3 rounded-3xl bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{t('slides.title')}</h1>
          <button
            type="button"
            onClick={handleCreateDocument}
            aria-label={t('slides.createDeck')}
            className="flex size-9 items-center justify-center rounded-full bg-surface-secondary"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => pptxInputRef.current?.click()}
            disabled={isImporting}
            className="rounded-full bg-surface-secondary px-3 py-2 text-sm disabled:opacity-40"
          >
            {isImporting ? t('slides.importing') : t('slides.importPptx')}
          </button>
        </div>
        <input
          ref={pptxInputRef}
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImportPptxFile(file)
          }}
        />
        {importError && <p className="text-sm text-danger">{importError}</p>}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {documentList.map((document) => (
            <button
              key={document.id}
              type="button"
              onClick={() => actions.selectDocument(document.id)}
              className={`rounded-2xl px-3 py-2 text-left ${document.id === currentDocumentId ? 'bg-accent text-accent-foreground' : 'bg-background/40 text-muted'}`}
            >
              <span className="block truncate font-medium">{document.title}</span>
              <span className="text-xs opacity-70">
                {t('slides.slideCount', { count: document.slides.length })}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col gap-4 rounded-3xl bg-surface p-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <label className="min-w-0 flex-1">
            <span className="text-sm text-muted">{t('slides.deckTitle')}</span>
            <input
              value={currentDocument.title}
              onChange={(event) =>
                actions.updateDocumentTitle(currentDocument.id, event.target.value)
              }
              className="mt-1 w-full rounded-2xl bg-background/60 px-4 py-2 text-lg font-semibold outline-none"
            />
          </label>
          <label className="min-w-44">
            <span className="text-sm text-muted">{t('slides.template')}</span>
            <select
              value={currentDocument.theme.id}
              onChange={(event) => actions.applyTemplate(currentDocument.id, event.target.value)}
              className="mt-1 w-full rounded-2xl bg-background/60 px-4 py-2 outline-none"
            >
              {BUILT_IN_SLIDE_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => actions.addSlide(currentDocument.id)}
              className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-2"
            >
              <Plus className="size-4" />
              {t('slides.addSlide')}
            </button>
            <button
              type="button"
              onClick={() => void handleProjectCurrentSlide()}
              disabled={isProjecting}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-accent-foreground disabled:opacity-40"
            >
              <Presentation className="size-4" />
              {isProjecting ? t('slides.projecting') : t('slides.projectSlide')}
            </button>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-[160px_minmax(0,1fr)] gap-4 max-lg:grid-cols-1">
          <ol className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {currentDocument.slides.map((slide, index) => (
              <li key={slide.id}>
                <button
                  type="button"
                  onClick={() => actions.selectSlide(slide.id)}
                  className={`w-full rounded-2xl p-2 text-left ${slide.id === selectedSlideId ? 'bg-accent/15 ring-2 ring-accent' : 'bg-background/40'}`}
                >
                  <MiniSlidePreview document={currentDocument} slide={slide} />
                  <span className="mt-2 block truncate text-sm">
                    {index + 1}. {slide.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="flex min-h-0 flex-col gap-4">
            <MiniSlidePreview document={currentDocument} slide={selectedSlide} />
            <div className="grid gap-3 rounded-2xl bg-background/40 p-4">
              <label>
                <span className="text-sm text-muted">{t('slides.slideTitle')}</span>
                <input
                  value={selectedSlide.title}
                  onChange={(event) =>
                    actions.updateSlideTitle(
                      currentDocument.id,
                      selectedSlide.id,
                      event.target.value
                    )
                  }
                  className="mt-1 w-full rounded-xl bg-surface px-3 py-2 outline-none"
                />
              </label>
              <label>
                <span className="text-sm text-muted">{t('slides.backgroundColor')}</span>
                <input
                  type="color"
                  value={getSlideBackgroundColor(selectedSlide)}
                  onChange={(event) =>
                    actions.updateSlideBackgroundColor(
                      currentDocument.id,
                      selectedSlide.id,
                      event.target.value
                    )
                  }
                  className="mt-1 block h-10 w-16 rounded-xl bg-surface"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  actions.addTextElement(
                    currentDocument.id,
                    selectedSlide.id,
                    t('slides.defaultText')
                  )
                }
                className="inline-flex w-fit items-center gap-2 rounded-full bg-surface-secondary px-4 py-2"
              >
                <Type className="size-4" />
                {t('slides.addText')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <aside className="flex min-h-0 flex-col gap-3 rounded-3xl bg-surface p-4 max-2xl:col-span-2 max-xl:col-span-1">
        <h2 className="text-lg font-semibold">{t('slides.elements')}</h2>
        {textElements.length === 0 ? (
          <p className="text-sm text-muted">{t('slides.noTextElements')}</p>
        ) : (
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {textElements.map((element) => (
              <div key={element.id} className="rounded-2xl bg-background/40 p-3">
                <textarea
                  value={element.text}
                  aria-label={t('slides.textContent')}
                  onChange={(event) =>
                    actions.updateTextElement(currentDocument.id, selectedSlide.id, element.id, {
                      text: event.target.value
                    })
                  }
                  className="min-h-24 w-full resize-none rounded-xl bg-surface px-3 py-2 outline-none"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="text-sm text-muted">
                    {t('slides.fontSize')}
                    <input
                      type="number"
                      min={12}
                      max={240}
                      value={element.style.fontSize}
                      onChange={(event) =>
                        actions.updateTextElement(
                          currentDocument.id,
                          selectedSlide.id,
                          element.id,
                          {
                            style: { fontSize: Number(event.target.value) }
                          }
                        )
                      }
                      className="ml-2 w-20 rounded-xl bg-surface px-2 py-1 text-foreground outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={t('slides.removeElement')}
                    onClick={() =>
                      actions.removeElement(currentDocument.id, selectedSlide.id, element.id)
                    }
                    className="flex size-8 items-center justify-center rounded-full text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
