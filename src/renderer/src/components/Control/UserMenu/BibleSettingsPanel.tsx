import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@heroui/react/input'
import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { Button } from '@heroui/react/button'
import { Label } from 'react-aria-components'
import { Eye, EyeOff, FolderOpen, ExternalLink } from 'lucide-react'
import { useSettingsStore, AZURE_REGION_OPTIONS } from '@renderer/stores/settings'
import type { SpeechProvider } from '@renderer/stores/settings'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { saveSpeechKey, loadSpeechKey, deleteSpeechKey } from '@renderer/lib/speech-key-storage'
import { toast } from '@heroui/react/toast'
import { parseDuration, formatDurationHMS } from '@renderer/lib/parse-duration'
import { isElectron } from '@renderer/lib/env'

const PROVIDER_OPTIONS: { value: SpeechProvider; electronOnly?: boolean; webOnly?: boolean }[] = [
  { value: 'azure' },
  { value: 'gcp' },
  { value: 'webSpeech', webOnly: true },
  { value: 'whisper', electronOnly: true }
]

const PROVIDER_LABEL_KEYS = {
  azure: 'preferences.bible.providerAzure',
  gcp: 'preferences.bible.providerGcp',
  webSpeech: 'preferences.bible.providerWebSpeech',
  whisper: 'preferences.bible.providerWhisper'
} as const

export default function BibleSettingsPanel(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const speech = useSettingsStore((s) => s.speech)
  const setSpeech = useSettingsStore((s) => s.setSpeech)
  const speechMaxSessionSec = useBibleSettingsStore((s) => s.speechMaxSessionSec)
  const setSpeechMaxSessionSec = useBibleSettingsStore((s) => s.setSpeechMaxSessionSec)

  // Azure state
  const [azureKey, setAzureKey] = useState('')
  const [originalAzureKey, setOriginalAzureKey] = useState('')
  const [showAzureKey, setShowAzureKey] = useState(false)
  const [azureRegion, setAzureRegion] = useState(speech.azure.region)
  const [originalAzureRegion, setOriginalAzureRegion] = useState(speech.azure.region)
  const [isLoadingAzureKey, setIsLoadingAzureKey] = useState(true)
  const [isTesting, setIsTesting] = useState(false)
  const [azureTestPassed, setAzureTestPassed] = useState(false)

  // GCP state
  const [gcpKey, setGcpKey] = useState('')
  const [originalGcpKey, setOriginalGcpKey] = useState('')
  const [showGcpKey, setShowGcpKey] = useState(false)
  const [isLoadingGcpKey, setIsLoadingGcpKey] = useState(true)

  // Whisper state
  const [whisperDir, setWhisperDir] = useState(speech.whisper.modelDir)

  const [maxSessionInput, setMaxSessionInput] = useState(formatDurationHMS(speechMaxSessionSec))

  const activeProvider = speech.activeProvider

  // Load Azure key on mount
  useEffect(() => {
    loadSpeechKey('azure')
      .then((key) => {
        const loaded = key ?? ''
        setAzureKey(loaded)
        setOriginalAzureKey(loaded)
        setOriginalAzureRegion(speech.azure.region)
        if (loaded && speech.azure.region) setAzureTestPassed(true)
      })
      .catch((e) => console.error('[BibleSettings] Failed to load Azure key:', e))
      .finally(() => setIsLoadingAzureKey(false))
  }, [speech.azure.region])

  // Load GCP key on mount
  useEffect(() => {
    loadSpeechKey('gcp')
      .then((key) => {
        const loaded = key ?? ''
        setGcpKey(loaded)
        setOriginalGcpKey(loaded)
      })
      .catch((e) => console.error('[BibleSettings] Failed to load GCP key:', e))
      .finally(() => setIsLoadingGcpKey(false))
  }, [])

  // Keep whisper dir in sync with store
  useEffect(() => {
    setWhisperDir(speech.whisper.modelDir)
  }, [speech.whisper.modelDir])

  // On mount: if whisper dir is set in Electron, restore it to main process
  useEffect(() => {
    if (isElectron() && speech.whisper.modelDir) {
      window.api.app.setModelDir(speech.whisper.modelDir).catch(() => {})
    }
  }, [speech.whisper.modelDir])

  // Reset azure test if key/region changes
  useEffect(() => {
    if (azureKey !== originalAzureKey || azureRegion !== originalAzureRegion) {
      setAzureTestPassed(false)
    }
  }, [azureKey, azureRegion, originalAzureKey, originalAzureRegion])

  // --- Azure handlers ---
  const handleAzureSave = async (): Promise<void> => {
    try {
      if (azureKey.trim()) {
        await saveSpeechKey('azure', azureKey.trim())
        setSpeech({ ...speech, azure: { ...speech.azure, region: azureRegion } })
        setOriginalAzureKey(azureKey)
        setOriginalAzureRegion(azureRegion)
        toast.success(t('toast.azureSpeechSaved'))
      } else {
        await deleteSpeechKey('azure')
        setOriginalAzureKey('')
        setAzureTestPassed(false)
        toast.success(t('toast.azureSpeechCleared'))
      }
    } catch (error) {
      console.error('[BibleSettings] Failed to save Azure settings:', error)
      toast.danger(t('toast.azureSpeechSaveFailed'))
    }
  }

  const handleTestConnection = async (): Promise<void> => {
    if (!azureKey.trim()) {
      toast.warning(t('toast.azureSpeechKeyRequired'))
      return
    }
    setIsTesting(true)
    try {
      const { SpeechConfig, SpeechRecognizer } =
        await import('microsoft-cognitiveservices-speech-sdk')
      const config = SpeechConfig.fromSubscription(azureKey.trim(), azureRegion)
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
      setAzureTestPassed(true)
    } catch (error) {
      console.error('[BibleSettings] Test connection failed:', error)
      toast.danger(t('toast.azureSpeechTestFailed'))
      setAzureTestPassed(false)
    } finally {
      setIsTesting(false)
    }
  }

  const azureHasChanges = azureKey !== originalAzureKey || azureRegion !== originalAzureRegion

  // --- GCP handlers ---
  const handleGcpSave = async (): Promise<void> => {
    try {
      if (gcpKey.trim()) {
        await saveSpeechKey('gcp', gcpKey.trim())
        setOriginalGcpKey(gcpKey)
        toast.success(t('toast.gcpSpeechSaved'))
      } else {
        await deleteSpeechKey('gcp')
        setOriginalGcpKey('')
        toast.success(t('toast.gcpSpeechCleared'))
      }
    } catch (error) {
      console.error('[BibleSettings] Failed to save GCP settings:', error)
      toast.danger(t('toast.gcpSpeechSaveFailed'))
    }
  }

  const gcpHasChanges = gcpKey !== originalGcpKey

  // --- Whisper handlers ---
  const handleSelectWhisperDir = async (): Promise<void> => {
    if (!isElectron()) return
    const dir = await window.api.app.selectDirectory()
    if (dir) {
      await window.api.app.setModelDir(dir)
      setWhisperDir(dir)
      setSpeech({ ...speech, whisper: { ...speech.whisper, modelDir: dir } })
    }
  }

  // --- Provider change ---
  const handleProviderChange = (provider: SpeechProvider): void => {
    setSpeech({ ...speech, activeProvider: provider })
  }

  const visibleProviders = PROVIDER_OPTIONS.filter((p) => {
    if (p.electronOnly && !isElectron()) return false
    if (p.webOnly && isElectron()) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Provider selector */}
      <Select
        variant="secondary"
        value={activeProvider}
        onChange={(key) => handleProviderChange(key as SpeechProvider)}
        aria-label={t('preferences.bible.speechProvider')}
      >
        <Label>{t('preferences.bible.speechProvider')}</Label>
        <Select.Trigger className="rounded-full pl-5">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {visibleProviders.map((p) => (
              <ListBox.Item
                key={p.value}
                id={p.value}
                textValue={t(PROVIDER_LABEL_KEYS[p.value])}
                className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
              >
                {t(PROVIDER_LABEL_KEYS[p.value])}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* Azure panel */}
      {activeProvider === 'azure' && (
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('preferences.bible.azureSpeechKey')}</Label>
            <div className="relative w-full">
              <Input
                type={showAzureKey ? 'text' : 'password'}
                variant="secondary"
                value={azureKey}
                onChange={(e) => setAzureKey(e.target.value)}
                placeholder={t('preferences.bible.azureSpeechKeyPlaceholder')}
                disabled={isLoadingAzureKey}
                className="w-full rounded-full pr-12"
              />
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowAzureKey(!showAzureKey)}
                className="absolute right-1 top-1/2 -translate-y-1/2"
                aria-label={showAzureKey ? t('common.hide') : t('common.show')}
              >
                {showAzureKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>

          <Select
            variant="secondary"
            value={azureRegion}
            onChange={(key) => setAzureRegion(String(key))}
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
              onPress={handleAzureSave}
              isDisabled={isLoadingAzureKey || !azureTestPassed || !azureHasChanges}
              className="rounded-full"
            >
              {t('common.save')}
            </Button>
            <Button
              variant="tertiary"
              onPress={handleTestConnection}
              isDisabled={
                isLoadingAzureKey ||
                !azureKey.trim() ||
                isTesting ||
                (azureTestPassed && !azureHasChanges)
              }
              className="rounded-full"
            >
              {isTesting ? t('preferences.bible.testing') : t('preferences.bible.testConnection')}
            </Button>
          </div>
        </div>
      )}

      {/* GCP panel */}
      {activeProvider === 'gcp' && (
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('preferences.bible.gcpSpeechKey')}</Label>
            <div className="relative w-full">
              <Input
                type={showGcpKey ? 'text' : 'password'}
                variant="secondary"
                value={gcpKey}
                onChange={(e) => setGcpKey(e.target.value)}
                placeholder={t('preferences.bible.gcpSpeechKeyPlaceholder')}
                disabled={isLoadingGcpKey}
                className="w-full rounded-full pr-12"
              />
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowGcpKey(!showGcpKey)}
                className="absolute right-1 top-1/2 -translate-y-1/2"
                aria-label={showGcpKey ? t('common.hide') : t('common.show')}
              >
                {showGcpKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onPress={handleGcpSave}
              isDisabled={isLoadingGcpKey || !gcpHasChanges}
              className="rounded-full"
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}

      {/* Web Speech panel */}
      {activeProvider === 'webSpeech' && (
        <div className="space-y-4">
          <Select
            variant="secondary"
            value={speech.azure.language}
            onChange={(key) =>
              setSpeech({
                ...speech,
                azure: { ...speech.azure, language: key as 'zh-TW' | 'zh-CN' }
              })
            }
            aria-label={t('preferences.bible.speechLanguage')}
          >
            <Label>{t('preferences.bible.speechLanguage')}</Label>
            <Select.Trigger className="rounded-full pl-5">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item
                  id="zh-TW"
                  textValue="繁體中文 (zh-TW)"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  繁體中文 (zh-TW)
                </ListBox.Item>
                <ListBox.Item
                  id="zh-CN"
                  textValue="简体中文 (zh-CN)"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  简体中文 (zh-CN)
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      )}

      {/* Whisper panel (Electron only) */}
      {activeProvider === 'whisper' && (
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">{t('preferences.bible.whisperModelDir')}</Label>
            <div className="flex gap-2 items-center">
              <div className="flex-1 text-sm text-muted truncate rounded-full bg-secondary px-4 py-2 min-w-0">
                {whisperDir || t('preferences.bible.whisperNoDirSelected')}
              </div>
              {isElectron() && (
                <Button
                  variant="secondary"
                  onPress={handleSelectWhisperDir}
                  className="rounded-full shrink-0 flex items-center gap-1.5"
                >
                  <FolderOpen className="size-4" />
                  {t('preferences.bible.whisperSelectDir')}
                </Button>
              )}
            </div>
          </div>

          <Select
            variant="secondary"
            value={speech.whisper.language}
            onChange={(key) =>
              setSpeech({
                ...speech,
                whisper: { ...speech.whisper, language: key as 'zh-TW' | 'zh-CN' }
              })
            }
            aria-label={t('preferences.bible.speechLanguage')}
          >
            <Label>{t('preferences.bible.speechLanguage')}</Label>
            <Select.Trigger className="rounded-full pl-5">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item
                  id="zh-TW"
                  textValue="繁體中文 (zh-TW)"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  繁體中文 (zh-TW)
                </ListBox.Item>
                <ListBox.Item
                  id="zh-CN"
                  textValue="简体中文 (zh-CN)"
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  简体中文 (zh-CN)
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>

          <div>
            <p className="text-sm text-muted mb-2">
              {t('preferences.bible.whisperDownloadModels')}
            </p>
            <div className="space-y-1">
              {[
                {
                  label: 'Whisper Base (~150MB)',
                  url: 'https://huggingface.co/onnx-community/whisper-base/tree/main'
                },
                {
                  label: 'Whisper Small (~500MB)',
                  url: 'https://huggingface.co/onnx-community/whisper-small/tree/main'
                },
                {
                  label: 'Whisper Large-v3 (~3GB)',
                  url: 'https://huggingface.co/onnx-community/whisper-large-v3/tree/main'
                }
              ].map((m) => (
                <a
                  key={m.url}
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {m.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Max session duration */}
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
