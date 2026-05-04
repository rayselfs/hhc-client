import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@heroui/react/input'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Button } from '@heroui/react/button'
import { Label } from 'react-aria-components'
import { Eye, EyeOff } from 'lucide-react'
import { useSettingsStore, AZURE_REGION_OPTIONS } from '@renderer/stores/settings'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { saveSpeechKey, loadSpeechKey, deleteSpeechKey } from '@renderer/lib/speech-key-storage'
import { toast } from '@heroui/react/toast'
import { parseDuration, formatDurationHMS } from '@renderer/lib/parse-duration'

export default function BibleSettingsPanel(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const speech = useSettingsStore((s) => s.speech)
  const setSpeech = useSettingsStore((s) => s.setSpeech)
  const speechMaxSessionSec = useBibleSettingsStore((s) => s.speechMaxSessionSec)
  const setSpeechMaxSessionSec = useBibleSettingsStore((s) => s.setSpeechMaxSessionSec)

  const [apiKey, setApiKey] = useState('')
  const [originalApiKey, setOriginalApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [region, setRegion] = useState(speech.azure.region)
  const [originalRegion, setOriginalRegion] = useState(speech.azure.region)
  const [isLoadingKey, setIsLoadingKey] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [testPassed, setTestPassed] = useState(false)
  const [maxSessionInput, setMaxSessionInput] = useState(formatDurationHMS(speechMaxSessionSec))

  useEffect(() => {
    loadSpeechKey('azure')
      .then((key) => {
        const loadedKey = key ?? ''
        setApiKey(loadedKey)
        setOriginalApiKey(loadedKey)
        setOriginalRegion(speech.azure.region)
        if (loadedKey && speech.azure.region) {
          setTestPassed(true)
        }
      })
      .catch((error) => {
        console.error('[BibleSettings] Failed to load API key:', error)
      })
      .finally(() => {
        setIsLoadingKey(false)
      })
  }, [speech.azure.region])

  useEffect(() => {
    if (apiKey !== originalApiKey || region !== originalRegion) {
      setTestPassed(false)
    }
  }, [apiKey, region, originalApiKey, originalRegion])

  const handleSaveSettings = async (): Promise<void> => {
    try {
      if (apiKey.trim()) {
        await saveSpeechKey('azure', apiKey.trim())
        setSpeech({ ...speech, azure: { ...speech.azure, region } })
        setOriginalApiKey(apiKey)
        setOriginalRegion(region)
        toast.success(t('toast.azureSpeechSaved'))
      } else {
        await deleteSpeechKey('azure')
        setOriginalApiKey('')
        setOriginalRegion(speech.azure.region)
        setTestPassed(false)
        toast.success(t('toast.azureSpeechCleared'))
      }
    } catch (error) {
      console.error('[BibleSettings] Failed to save settings:', error)
      toast.danger(t('toast.azureSpeechSaveFailed'))
    }
  }

  const handleTestConnection = async (): Promise<void> => {
    if (!apiKey.trim()) {
      toast.warning(t('toast.azureSpeechKeyRequired'))
      return
    }

    setIsTesting(true)
    try {
      const { SpeechConfig, SpeechRecognizer } =
        await import('microsoft-cognitiveservices-speech-sdk')

      const config = SpeechConfig.fromSubscription(apiKey.trim(), region)
      const testLanguage =
        i18n.language === 'zh-TW' ? 'zh-TW' : i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US'
      config.speechRecognitionLanguage = testLanguage

      const recognizer = new SpeechRecognizer(config)

      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          recognizer.close()
          reject(new Error('Connection timeout'))
        }, 5000)

        recognizer.sessionStarted = () => {
          clearTimeout(timeoutId)
          recognizer.close()
          resolve()
        }

        recognizer.canceled = () => {
          clearTimeout(timeoutId)
          recognizer.close()
          reject(new Error('Connection failed'))
        }

        recognizer.startContinuousRecognitionAsync(
          () => {},
          (error) => {
            clearTimeout(timeoutId)
            recognizer.close()
            reject(error)
          }
        )
      })

      toast.success(t('toast.azureSpeechTestSuccess'))
      setTestPassed(true)
    } catch (error) {
      console.error('[BibleSettings] Test connection failed:', error)
      toast.danger(t('toast.azureSpeechTestFailed'))
      setTestPassed(false)
    } finally {
      setIsTesting(false)
    }
  }

  const hasChanges = apiKey !== originalApiKey || region !== originalRegion

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block">{t('preferences.bible.azureSpeechKey')}</Label>
        <div className="relative w-full">
          <Input
            type={showApiKey ? 'text' : 'password'}
            variant="secondary"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('preferences.bible.azureSpeechKeyPlaceholder')}
            disabled={isLoadingKey}
            className="w-full rounded-full pr-12"
          />
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowApiKey(!showApiKey)}
            className="absolute right-1 top-1/2 -translate-y-1/2"
            aria-label={showApiKey ? t('common.hide') : t('common.show')}
          >
            {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
      </div>

      <Select
        variant="secondary"
        value={region}
        onChange={(key) => setRegion(String(key))}
        aria-label={t('preferences.bible.azureSpeechRegion')}
      >
        <Label>{t('preferences.bible.azureSpeechRegion')}</Label>
        <Select.Trigger className="rounded-full pl-5">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {AZURE_REGION_OPTIONS.map((opt) => (
              <ListBox.Item
                key={opt.value}
                id={opt.value}
                textValue={opt.label}
                className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
              >
                {opt.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <div className="flex gap-2">
        <Button
          variant="primary"
          onPress={handleSaveSettings}
          isDisabled={isLoadingKey || !testPassed || !hasChanges}
          className="rounded-full"
        >
          {t('common.save')}
        </Button>
        <Button
          variant="tertiary"
          onPress={handleTestConnection}
          isDisabled={isLoadingKey || !apiKey.trim() || isTesting || (testPassed && !hasChanges)}
          className="rounded-full"
        >
          {isTesting ? t('preferences.bible.testing') : t('preferences.bible.testConnection')}
        </Button>
      </div>

      <div>
        <Label className="mb-2 block">{t('preferences.bible.maxSessionDuration')}</Label>
        <Input
          type="text"
          variant="secondary"
          value={maxSessionInput}
          onChange={(e) => setMaxSessionInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const sec = parseDuration(maxSessionInput)
              if (sec !== null && sec > 0) {
                setSpeechMaxSessionSec(sec)
                setMaxSessionInput(formatDurationHMS(sec))
              } else {
                setMaxSessionInput(formatDurationHMS(speechMaxSessionSec))
              }
            }
          }}
          onBlur={() => {
            const sec = parseDuration(maxSessionInput)
            if (sec !== null && sec > 0) {
              setSpeechMaxSessionSec(sec)
              setMaxSessionInput(formatDurationHMS(sec))
            } else {
              setMaxSessionInput(formatDurationHMS(speechMaxSessionSec))
            }
          }}
          placeholder="e.g. 1h30m, 01:30:00"
          className="rounded-full w-full"
        />
      </div>
    </div>
  )
}
