import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@heroui/react/card'
import { Button } from '@heroui/react/button'
import { ScrollShadow } from '@heroui/react/scroll-shadow'
import { Download, Mic, MicOff, Trash2, X } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings'
import type { SpeechSettings, SpeechProvider } from '@renderer/stores/settings'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleSpeechStore } from '@renderer/stores/bible-speech'
import { loadSpeechKey } from '@renderer/lib/speech-key-storage'
import { createSpeechAdapter, AzureSpeechAdapter } from '@renderer/lib/speech-adapter'
import type { SpeechAdapter } from '@renderer/lib/speech-adapter/speech-adapter.interface'
import { parseVerseReference } from '@renderer/lib/verse-parser'
import { matchBookName, getBookConfig } from '@renderer/lib/bible-book-matcher'
import { getBookNameI18n } from '@renderer/lib/bible-utils'
import { formatDurationHMS } from '@renderer/lib/parse-duration'
import GlassDivider from '@renderer/components/Common/GlassDivider'

interface RecognizedVerse {
  id: string
  bookNumber: number
  bookName: string
  chapter: number
  verse: number
  text: string
  timestamp: number
}

interface RawRecognizedEntry {
  text: string
  confidence: number | null
  timestamp: number
}

const PROVIDER_REQUIREMENTS: Record<
  SpeechProvider,
  { requiresOnline: boolean; isReady: (s: SpeechSettings) => boolean }
> = {
  azure:     { requiresOnline: true,  isReady: (s) => !!s.azure.region },
  gcp:       { requiresOnline: true,  isReady: () => true },
  webSpeech: { requiresOnline: true,  isReady: () => true },
  whisper:   { requiresOnline: false, isReady: (s) => !!s.whisper.modelDir }
}

export default function SpeechRecognitionCard(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const speech = useSettingsStore((s) => s.speech)
  const selectedVersionId = useBibleSettingsStore((s) => s.selectedVersionId)
  const bibleContent = useBibleStore((s) => s.content)

  const elapsedSeconds = useBibleSpeechStore((s) => s.elapsedSeconds)
  const incrementElapsedSeconds = useBibleSpeechStore((s) => s.incrementElapsedSeconds)
  const resetElapsedSeconds = useBibleSpeechStore((s) => s.resetElapsedSeconds)

  const [isRecognizing, setIsRecognizing] = useState(false)
  const [recognizedVerses, setRecognizedVerses] = useState<RecognizedVerse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adapter, setAdapter] = useState<SpeechAdapter | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [hasRawLog, setHasRawLog] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rawLogRef = useRef<RawRecognizedEntry[]>([])
  const speechMaxSessionSec = useBibleSettingsStore((s) => s.speechMaxSessionSec)

  const handleStopRecognition = useCallback((): void => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
    if (adapter) {
      adapter.stop().catch(() => {})
      adapter.dispose()
      setAdapter(null)
    }
    setIsRecognizing(false)
  }, [adapter])

  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true)
    const handleOffline = (): void => {
      setIsOnline(false)
      if (isRecognizing) {
        handleStopRecognition()
        setError('network-offline')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isRecognizing, handleStopRecognition])

  useEffect(() => {
    return () => {
      if (adapter) {
        adapter.dispose()
      }
    }
  }, [adapter])

  useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
      }
    }
  }, [])

  const handleRecognized = useCallback(
    (text: string) => {
      const parsed = parseVerseReference(text)
      if (!parsed) return

      const match = matchBookName(parsed.book)
      if (!match) return

      const bookConfig = getBookConfig(match.bookNumber)
      if (!bookConfig) return

      if (!selectedVersionId) return

      const books = bibleContent.get(selectedVersionId)
      const book = books?.find((b) => b.number === match.bookNumber)
      const chapter = book?.chapters.find((c) => c.number === parsed.chapter)
      const verseData = chapter?.verses.find((v) => v.number === parsed.verse)

      if (!verseData) return

      const bookName = getBookNameI18n(t, match.bookNumber)

      const verse: RecognizedVerse = {
        id: crypto.randomUUID(),
        bookNumber: match.bookNumber,
        bookName,
        chapter: parsed.chapter,
        verse: parsed.verse,
        text: verseData.text,
        timestamp: Date.now()
      }

      setRecognizedVerses((prev) => [verse, ...prev])
    },
    [t, selectedVersionId, bibleContent]
  )

  const handleStartRecognition = async (): Promise<void> => {
    try {
      const provider = speech.activeProvider
      let newAdapter: SpeechAdapter

      if (provider === 'azure') {
        const apiKey = await loadSpeechKey('azure')
        if (!apiKey || !speech.azure.region) {
          setError('config-required')
          return
        }
        const locale =
          i18n.language === 'zh-TW' ? 'zh-TW' : i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US'
        newAdapter = new AzureSpeechAdapter({
          subscriptionKey: apiKey,
          region: speech.azure.region,
          language: locale as 'zh-TW' | 'zh-CN',
          maxSessionMs: speechMaxSessionSec * 1000
        })
      } else if (provider === 'whisper') {
        if (!speech.whisper.modelDir) {
          setError('config-required')
          return
        }
        newAdapter = createSpeechAdapter(provider, speech, {
          maxSessionMs: speechMaxSessionSec * 1000
        })
      } else {
        newAdapter = createSpeechAdapter(provider, speech, {
          maxSessionMs: speechMaxSessionSec * 1000
        })
      }

      newAdapter.on('recognized', (data) => {
        if (data.text) {
          handleRecognized(data.text)
        }
      })

      newAdapter.on('rawRecognized', (data) => {
        rawLogRef.current.push({
          text: data.text,
          confidence: data.confidence,
          timestamp: Date.now()
        })
        setHasRawLog(true)
      })

      newAdapter.on('error', () => {
        setError('start-failed')
        setIsRecognizing(false)
      })

      newAdapter.on('sessionStopped', () => {
        setIsRecognizing(false)
        if (elapsedTimerRef.current) {
          clearInterval(elapsedTimerRef.current)
          elapsedTimerRef.current = null
        }
      })

      newAdapter.on('idleTimeout', () => {
        setError('idle-timeout')
        setIsRecognizing(false)
      })

      newAdapter.on('maxDurationReached', () => {
        setError('max-duration')
        setIsRecognizing(false)
      })

      await newAdapter.start()

      elapsedTimerRef.current = setInterval(() => {
        incrementElapsedSeconds()
      }, 1000)

      setAdapter(newAdapter)
      setIsRecognizing(true)
      setError(null)
    } catch {
      setError('start-failed')
    }
  }

  const handleClearAll = (): void => {
    setRecognizedVerses([])
    rawLogRef.current = []
    setHasRawLog(false)
    setError(null)
    resetElapsedSeconds()
  }

  const handleExportLog = (): void => {
    if (rawLogRef.current.length === 0) return

    const lines = rawLogRef.current.map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })
      const conf = entry.confidence !== null ? ` [${entry.confidence.toFixed(2)}]` : ''
      return `${time}${conf} ${entry.text}`
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `speech-log-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRemoveVerse = (id: string): void => {
    setRecognizedVerses((prev) => prev.filter((v) => v.id !== id))
  }

  const handleVerseClick = (verse: RecognizedVerse): void => {
    useBibleStore.getState().navigateTo({
      bookNumber: verse.bookNumber,
      chapter: verse.chapter,
      verse: verse.verse
    })
  }

  const providerReqs = PROVIDER_REQUIREMENTS[speech.activeProvider]
  const canStart =
    !isRecognizing &&
    providerReqs.isReady(speech) &&
    (!providerReqs.requiresOnline || isOnline)

  return (
    <Card className="flex flex-col h-full p-0 gap-2">
      <Card.Header className="shrink-0 flex-row! items-center justify-between p-0 pt-2 pl-2 pr-3">
        <div className="flex items-center gap-1">
          <Button
            variant={isRecognizing ? 'danger' : 'primary'}
            onPress={isRecognizing ? handleStopRecognition : handleStartRecognition}
            isDisabled={!canStart && !isRecognizing}
            className="flex items-center gap-1.5"
          >
            <span className="max-lg:hidden">
              {isRecognizing ? t('bible.speech.stop') : t('bible.speech.start')}
            </span>
            {isRecognizing ? (
              <MicOff size={16} className="lg:hidden" />
            ) : (
              <Mic size={16} className="lg:hidden" />
            )}
          </Button>
          <span className="text-xs text-muted tabular-nums ml-1">
            {formatDurationHMS(elapsedSeconds)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={handleExportLog}
            isDisabled={!hasRawLog}
            aria-label={t('bible.speech.exportLog')}
          >
            <Download size={18} />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={handleClearAll}
            isDisabled={recognizedVerses.length === 0}
            aria-label={t('bible.speech.clearAll')}
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </Card.Header>
      <GlassDivider />
      <Card.Content className="flex-1 min-h-0 overflow-hidden p-0">
        {error && (
          <div className="px-4 pt-2 pb-1 text-sm text-danger">
            {error === 'network-offline' && t('bible.speech.networkOffline')}
            {error === 'config-required' && t('bible.speech.configRequired')}
            {error === 'start-failed' && t('bible.speech.startFailed')}
            {error === 'idle-timeout' && t('bible.speech.idleTimeout')}
            {error === 'max-duration' && t('bible.speech.maxDuration')}
            {error === 'error-retry-exceeded' && t('bible.speech.errorRetryExceeded')}
          </div>
        )}

        {recognizedVerses.length === 0 && (
          <div className="flex h-full items-center justify-center text-muted px-4">
            {isRecognizing ? t('bible.speech.listening') : error ? '' : t('bible.speech.empty')}
          </div>
        )}

        {recognizedVerses.length > 0 && (
          <ScrollShadow ref={scrollRef} className="h-full w-full" hideScrollBar>
            <div className="flex flex-col gap-2 p-2 pt-0">
              {recognizedVerses.map((verse) => (
                <div
                  key={verse.id}
                  className="flex items-center group rounded-3xl transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <button
                    type="button"
                    onClick={() => handleVerseClick(verse)}
                    className="flex-1 min-w-0 text-left p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-3xl"
                  >
                    <p className="truncate text-muted group-hover:text-accent-foreground/80 dark:group-hover:text-muted font-[Roboto_Variable,Roboto,sans-serif] text-xs">
                      {verse.bookName} {verse.chapter}:{verse.verse}
                    </p>
                    <p className="text-sm text-foreground group-hover:text-accent-foreground line-clamp-2 max-lg:line-clamp-1">
                      {verse.text}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="invisible shrink-0 mr-2 group-hover:visible cursor-pointer hover:bg-transparent!"
                    onPress={() => handleRemoveVerse(verse.id)}
                    aria-label={t('common.delete')}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollShadow>
        )}
      </Card.Content>
    </Card>
  )
}
