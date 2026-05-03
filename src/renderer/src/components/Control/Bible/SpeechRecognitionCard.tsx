import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@heroui/react/card'
import { Button } from '@heroui/react/button'
import { ScrollShadow } from '@heroui/react/scroll-shadow'
import { Mic, MicOff, Trash2, X } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { loadAzureSpeechKey } from '@renderer/lib/azure-speech-key-storage'
import { createSpeechAdapter } from '@renderer/lib/speech-adapter'
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

export default function SpeechRecognitionCard(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const azureSpeech = useSettingsStore((s) => s.azureSpeech)
  const selectedVersionId = useBibleSettingsStore((s) => s.selectedVersionId)
  const bibleContent = useBibleStore((s) => s.content)

  const [isRecognizing, setIsRecognizing] = useState(false)
  const [recognizedVerses, setRecognizedVerses] = useState<RecognizedVerse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [adapter, setAdapter] = useState<SpeechAdapter | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechMaxSessionSec = useBibleSettingsStore((s) => s.speechMaxSessionSec)

  const handleStopRecognition = useCallback((): void => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
    if (adapter) {
      adapter.stop().catch((err) => {
        console.error('[SpeechRecognitionCard] Stop recognition failed:', err)
      })
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
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current)
      }
      if (adapter) {
        adapter.dispose()
      }
    }
  }, [adapter])

  const handleRecognized = useCallback(
    (text: string) => {
      console.log('[Speech] Recognized raw text:', text)

      const parsed = parseVerseReference(text)
      if (!parsed) {
        console.warn('[Speech] Failed to parse verse reference:', text)
        return
      }
      console.log('[Speech] Parsed:', parsed)

      const match = matchBookName(parsed.book)
      if (!match) {
        console.warn('[Speech] Failed to match book name:', parsed.book)
        return
      }
      console.log('[Speech] Matched book:', match)

      const bookConfig = getBookConfig(match.bookNumber)
      if (!bookConfig) {
        console.warn('[Speech] Failed to get book config:', match.bookNumber)
        return
      }

      if (!selectedVersionId) {
        console.warn('[Speech] No version selected')
        return
      }

      const books = bibleContent.get(selectedVersionId)
      const book = books?.find((b) => b.number === match.bookNumber)
      const chapter = book?.chapters.find((c) => c.number === parsed.chapter)
      const verseData = chapter?.verses.find((v) => v.number === parsed.verse)

      if (!verseData) {
        console.warn('[Speech] Failed to get verse text')
        return
      }

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
      const apiKey = await loadAzureSpeechKey()
      if (!apiKey || !azureSpeech?.region) {
        setError('config-required')
        return
      }

      const locale =
        i18n.language === 'zh-TW' ? 'zh-TW' : i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US'

      const newAdapter = createSpeechAdapter({
        subscriptionKey: apiKey,
        region: azureSpeech.region,
        language: locale,
        maxSessionMs: speechMaxSessionSec * 1000
      })

      newAdapter.on('recognized', (data) => {
        if (data.text) {
          handleRecognized(data.text)
        }
      })

      newAdapter.on('error', (data) => {
        console.error('[SpeechRecognitionCard] Speech error:', data.error)
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
        setElapsedSeconds((s) => s + 1)
      }, 1000)

      setAdapter(newAdapter)
      setIsRecognizing(true)
      setError(null)
    } catch (err) {
      console.error('[SpeechRecognitionCard] Start recognition failed:', err)
      setError('start-failed')
    }
  }

  const handleClearAll = (): void => {
    setRecognizedVerses([])
    setError(null)
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

  const canStart = !isRecognizing && azureSpeech?.region && isOnline

  return (
    <Card className="flex flex-col h-full p-0 gap-2">
      <Card.Header className="shrink-0 flex-row! items-center justify-between p-0 pt-2 px-3">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-medium">{t('bible.speech.title')}</h3>
          <span className="text-xs text-muted tabular-nums ml-1">
            {formatDurationHMS(elapsedSeconds)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant={isRecognizing ? 'danger' : 'primary'}
            onPress={isRecognizing ? handleStopRecognition : handleStartRecognition}
            isDisabled={!canStart && !isRecognizing}
            className="flex items-center gap-1.5 max-lg:gap-1"
          >
            {isRecognizing ? <MicOff size={16} /> : <Mic size={16} />}
            <span className="max-lg:hidden">
              {isRecognizing ? t('bible.speech.stop') : t('bible.speech.start')}
            </span>
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
