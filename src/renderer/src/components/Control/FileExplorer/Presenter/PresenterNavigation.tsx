import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, ProgressBar } from '@heroui/react'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

export default function PresenterNavigation(): React.JSX.Element {
  const { t } = useTranslation()
  const canNext = useMediaProjectionStore((s) => s.canNext())
  const canPrev = useMediaProjectionStore((s) => s.canPrev())
  const currentIndex = useMediaProjectionStore((s) => s.currentIndex)
  const total = useMediaProjectionStore((s) => s.playlist.length)
  const next = useMediaProjectionStore((s) => s.next)
  const prev = useMediaProjectionStore((s) => s.prev)

  const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0

  return (
    <div className="pb-4 shrink-0 flex justify-center">
      <div className="flex items-center gap-3 w-80">
        <Button
          variant="outline"
          isIconOnly
          isDisabled={!canPrev}
          onPress={() => prev()}
          className="w-12 h-12 rounded-full shrink-0"
          aria-label={t('presenter.prev')}
        >
          <ChevronLeft className="w-7 h-7" />
        </Button>

        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="text-foreground/60 text-base text-center">
            {t('presenter.slideInfo', { current: currentIndex + 1, total })}
          </div>
          <ProgressBar
            value={progressPercent}
            minValue={0}
            maxValue={100}
            aria-label="progress"
            className="w-full"
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>

        <Button
          variant="outline"
          isIconOnly
          isDisabled={!canNext}
          onPress={() => next()}
          className="w-12 h-12 rounded-full shrink-0 size-5"
          aria-label={t('presenter.next')}
        >
          <ChevronRight className="w-7 h-7" />
        </Button>
      </div>
    </div>
  )
}
