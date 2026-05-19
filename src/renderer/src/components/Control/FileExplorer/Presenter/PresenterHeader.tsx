import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@heroui/react'

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
    <div className="flex items-center justify-between px-3 py-2 shrink-0">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          isIconOnly
          size="sm"
          onPress={onExit}
          aria-label={t('common.close')}
          className="text-white/70 hover:text-white"
        >
          <X size={20} />
        </Button>
        <span className="text-white/70 text-base font-mono">{formatElapsed(elapsed)}</span>
      </div>
      <span className="text-white/70 text-base font-mono">{formatClock(clockTime)}</span>
    </div>
  )
}
