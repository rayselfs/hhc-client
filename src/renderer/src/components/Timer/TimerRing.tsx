import { useRef, useEffect } from 'react'

interface TimerRingProps {
  progress: number
  size: number
  color?: 'accent' | 'danger'
  className?: string
  children?: React.ReactNode
}

export default function TimerRing({
  progress,
  size,
  color = 'accent',
  className,
  children
}: TimerRingProps): React.JSX.Element {
  const prevProgress = useRef<number | null>(null)
  const circleRef = useRef<SVGCircleElement>(null)

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
  const offset = (progress / 100) * circumference

  const strokeClass = color === 'danger' ? 'stroke-danger' : 'stroke-accent'

  return (
    <div className={`relative ${className ?? ''}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90 w-full h-full">
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
