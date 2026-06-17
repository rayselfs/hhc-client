import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@heroui/react'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

interface PresenterHeaderProps {
  onExit: () => void
}

export default function PresenterHeader({ onExit }: PresenterHeaderProps): React.JSX.Element {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)
  const [clockTime, setClockTime] = useState(() => new Date())
  const readiness = useMediaProjectionStore((state) => state.lastReadinessReport?.summary)
  const skippedCount = readiness
    ? readiness.preparing + readiness.unsupported + readiness.missing + readiness.failed
    : 0

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setClockTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-between px-3 h-12 shrink-0">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          isIconOnly
          onPress={onExit}
          aria-label={t('common.close')}
          className="text-foreground/70 hover:text-foreground"
        >
          <X size={20} />
        </Button>
        <span className="text-foreground/70 text-lg font-mono">{formatElapsed(elapsed)}</span>
        {readiness && skippedCount > 0 && (
          <span
            className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-700"
            title={t('fileExplorer.presenter.readinessSummary', {
              defaultValue:
                '{{ready}} ready, {{preparing}} preparing, {{unsupported}} unsupported, {{missing}} missing, {{failed}} failed',
              ready: readiness.ready,
              preparing: readiness.preparing,
              unsupported: readiness.unsupported,
              missing: readiness.missing,
              failed: readiness.failed
            })}
          >
            {t('fileExplorer.presenter.skippedItems', '{{count}} skipped', {
              count: skippedCount
            })}
          </span>
        )}
      </div>
      <span className="text-foreground/70 text-lg font-mono">{formatClock(clockTime)}</span>
    </div>
  )
}
