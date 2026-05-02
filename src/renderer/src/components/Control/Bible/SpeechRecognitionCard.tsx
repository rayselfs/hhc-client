import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@heroui/react/card'
import { Button } from '@heroui/react/button'
import { Mic, MicOff, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { loadAzureSpeechKey } from '@renderer/lib/azure-speech-key-storage'
import { createSpeechAdapter } from '@renderer/lib/speech-adapter'
import type { SpeechAdapter } from '@renderer/lib/speech-adapter/speech-adapter.interface'
import { parseVerseReference } from '@renderer/lib/verse-parser'
import { matchBookName, getBookConfig } from '@renderer/lib/bible-book-matcher'
import { getBookNameI18n } from '@renderer/lib/bible-utils'

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

  const handleStopRecognition = useCallback((): void => {
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
      if (adapter) {
        adapter.dispose()
      }
    }
  }, [adapter])

  const handleRecognized = useCallback(
    (text: string) => {
      const parsed = parseVerseReference(text)
      if (!parsed) {
        console.warn('[Speech] Failed to parse verse reference:', text)
        return
      }

      const match = matchBookName(parsed.book)
      if (!match) {
        console.warn('[Speech] Failed to match book name:', parsed.book)
        return
      }

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
        language: locale
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
      })

      await newAdapter.start()

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
    window.dispatchEvent(
      new CustomEvent('bible:preview', {
        detail: {
          bookNumber: verse.bookNumber,
          chapter: verse.chapter,
          verse: verse.verse
        }
      })
    )
  }

  const canStart = !isRecognizing && azureSpeech?.region && isOnline

  return (
    <Card className="flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-3">
        <h3 className="text-sm font-medium">{t('bible.speech.title')}</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isRecognizing ? 'danger' : 'primary'}
            onPress={isRecognizing ? handleStopRecognition : handleStartRecognition}
            isDisabled={!canStart && !isRecognizing}
            className="flex items-center gap-1.5"
          >
            {isRecognizing ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{isRecognizing ? t('bible.speech.stop') : t('bible.speech.start')}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={handleClearAll}
            isDisabled={recognizedVerses.length === 0}
            isIconOnly
            aria-label={t('bible.speech.clearAll')}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="text-sm text-danger mb-2">
            {error === 'network-offline' && t('bible.speech.networkOffline')}
            {error === 'config-required' && t('bible.speech.configRequired')}
            {error === 'start-failed' && t('bible.speech.startFailed')}
          </div>
        )}

        {isRecognizing && recognizedVerses.length === 0 && (
          <div className="text-sm text-default-500">{t('bible.speech.listening')}</div>
        )}

        {!isRecognizing && recognizedVerses.length === 0 && !error && (
          <div className="text-sm text-default-400">{t('bible.speech.empty')}</div>
        )}

        <div className="space-y-2">
          {recognizedVerses.map((verse) => (
            <button
              key={verse.id}
              type="button"
              className="flex w-full justify-between items-start p-2 hover:bg-default-100 rounded cursor-pointer group text-left"
              onClick={() => handleVerseClick(verse)}
            >
              <div className="flex-1 mr-2">
                <div className="text-xs font-medium text-default-700">
                  {verse.bookName} {verse.chapter}:{verse.verse}
                </div>
                <div className="text-xs text-default-600 mt-1 line-clamp-2">{verse.text}</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={t('common.delete')}
                onPress={(e) => {
                  e.continuePropagation()
                  handleRemoveVerse(verse.id)
                }}
              >
                <Trash2 size={14} />
              </Button>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
