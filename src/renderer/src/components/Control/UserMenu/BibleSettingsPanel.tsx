import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@heroui/react/input'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Button } from '@heroui/react/button'
import { Label } from 'react-aria-components'
import { Eye, EyeOff } from 'lucide-react'
import { useSettingsStore, AZURE_REGION_OPTIONS } from '@renderer/stores/settings'
import {
  saveAzureSpeechKey,
  loadAzureSpeechKey,
  deleteAzureSpeechKey
} from '@renderer/lib/azure-speech-key-storage'
import { toast } from '@heroui/react/toast'

export default function BibleSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const azureSpeech = useSettingsStore((s) => s.azureSpeech)
  const setAzureSpeech = useSettingsStore((s) => s.setAzureSpeech)

  const [apiKey, setApiKey] = useState('')
  const [originalApiKey, setOriginalApiKey] = useState('') // Track loaded value for comparison
  const [showApiKey, setShowApiKey] = useState(false)
  const [region, setRegion] = useState(azureSpeech?.region ?? 'eastasia')
  const [originalRegion] = useState(azureSpeech?.region ?? 'eastasia') // Track original region
  const [isLoadingKey, setIsLoadingKey] = useState(true)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    loadAzureSpeechKey()
      .then((key) => {
        const loadedKey = key ?? ''
        setApiKey(loadedKey)
        setOriginalApiKey(loadedKey)
      })
      .catch((error) => {
        console.error('[BibleSettings] Failed to load API key:', error)
      })
      .finally(() => {
        setIsLoadingKey(false)
      })
  }, [])

  const handleSaveSettings = async (): Promise<void> => {
    try {
      if (apiKey.trim()) {
        await saveAzureSpeechKey(apiKey.trim())
        setAzureSpeech({ region })
        toast.success(t('toast.azureSpeechSaved'))
      } else {
        await deleteAzureSpeechKey()
        setAzureSpeech(null)
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
      config.speechRecognitionLanguage = 'en-US'

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
    } catch (error) {
      console.error('[BibleSettings] Test connection failed:', error)
      toast.danger(t('toast.azureSpeechTestFailed'))
    } finally {
      setIsTesting(false)
    }
  }

  const hasChanges = apiKey !== originalApiKey || region !== originalRegion

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-2 block text-sm font-medium">
          {t('preferences.bible.azureSpeechKey')}
        </Label>
        <div className="flex gap-2">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('preferences.bible.azureSpeechKeyPlaceholder')}
            disabled={isLoadingKey}
            className="flex-1"
          />
          <Button
            variant="secondary"
            onPress={() => setShowApiKey(!showApiKey)}
            className="shrink-0 rounded-full px-3"
            aria-label={showApiKey ? t('common.hide') : t('common.show')}
          >
            {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted">{t('preferences.bible.azureSpeechKeyHint')}</p>
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
          isDisabled={isLoadingKey || !hasChanges}
          className="rounded-full"
        >
          {t('common.save')}
        </Button>
        <Button
          variant="secondary"
          onPress={handleTestConnection}
          isDisabled={isLoadingKey || !apiKey.trim() || isTesting}
          className="rounded-full"
        >
          {isTesting ? t('preferences.bible.testing') : t('preferences.bible.testConnection')}
        </Button>
      </div>
    </div>
  )
}
