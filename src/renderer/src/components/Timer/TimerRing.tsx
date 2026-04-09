import { useRef, useEffect, useState, useCallback } from 'react'

interface TimerRingProps {
  progress: number
  size: number
  color?: 'accent' | 'danger'
  className?: string
  children?: React.ReactNode
  responsive?: boolean
}

export default function TimerRing({
  progress,
  size,
  color = 'accent',
  className,
  children,
  responsive
}: TimerRingProps): React.JSX.Element {
  const prevProgress = useRef<number | null>(null)
  const circleRef = useRef<SVGCircleElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<number | null>(null)

  const measure = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const s = Math.floor(Math.min(el.clientWidth, el.clientHeight) * 0.95)
    setMeasured((prev) => (prev === s ? prev : s))
  }, [])

  useEffect(() => {
    if (!responsive) return
    const el = wrapperRef.current
    if (!el) return

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [responsive, measure])

  useEffect(() => {
    const el = circleRef.current
    if (prevProgress.current !== null && progress > prevProgress.current && el) {
      el.style.transition = 'none'
      const timeout = setTimeout(() => {
        el.style.transition = 'stroke-dashoffset 1s linear'
      }, 50)
      prevProgress.current = progress
      return () => clearTimeout(timeout)
    }
    prevProgress.current = progress
    return undefined
  }, [progress])

  const center = size / 2
  const strokeWidth = Math.max(Math.round(size * 0.02), 2)
  const radius = center - strokeWidth - 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  const strokeClass = color === 'danger' ? 'stroke-danger' : 'stroke-accent'

  if (responsive) {
    const ringSize = measured ?? 0

    return (
      <div
        ref={wrapperRef}
        className={`relative w-full h-full flex items-center justify-center ${className ?? ''}`}
      >
        <div className="relative @container" style={{ width: ringSize, height: ringSize }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="absolute inset-0 rotate-90 -scale-x-100 w-full h-full"
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
              fill="transparent"
              className="stroke-default"
            />
            <circle
              ref={circleRef}
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              className={strokeClass}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 rotate-90 -scale-x-100 w-full h-full"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          className="stroke-default"
        />
        <circle
          ref={circleRef}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          className={strokeClass}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}
