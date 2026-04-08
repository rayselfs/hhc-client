import { useRef, useId } from 'react'

type RingColor = 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info'

interface ProgressRingProps {
  value: number
  color?: RingColor
  size: number
  strokeRatio?: number
  isWarning?: boolean
  'aria-label'?: string
  children?: React.ReactNode
}

const GRADIENT_VARS: Record<RingColor, { start: string; end: string }> = {
  primary: {
    start: 'rgb(var(--hhc-gradient-primary-start))',
    end: 'rgb(var(--hhc-gradient-primary-end))'
  },
  secondary: {
    start: 'rgb(var(--hhc-gradient-secondary-start))',
    end: 'rgb(var(--hhc-gradient-secondary-end))'
  },
  error: {
    start: 'rgb(var(--hhc-gradient-error-start))',
    end: 'rgb(var(--hhc-gradient-error-end))'
  },
  warning: {
    start: 'rgb(var(--hhc-gradient-warning-start))',
    end: 'rgb(var(--hhc-gradient-warning-end))'
  },
  success: {
    start: 'rgb(var(--hhc-gradient-success-start))',
    end: 'rgb(var(--hhc-gradient-success-end))'
  },
  info: {
    start: 'rgb(var(--hhc-gradient-info-start))',
    end: 'rgb(var(--hhc-gradient-info-end))'
  }
}

export default function ProgressRing({
  value,
  color = 'primary',
  size,
  strokeRatio = 0.025,
  isWarning = false,
  'aria-label': ariaLabel,
  children
}: ProgressRingProps): React.JSX.Element {
  const uid = useId()
  const gradientId = `progress-ring-gradient-${uid}`
  const glowFilterId = `progress-ring-glow-${uid}`
  const innerShadowId = `progress-ring-inner-shadow-${uid}`
  const prevValueRef = useRef(value)

  const gradient = GRADIENT_VARS[color] ?? GRADIENT_VARS.primary

  const center = size / 2
  const strokeWidth = Math.max(2, Math.round(size * strokeRatio))
  const radius = center - strokeWidth / 2 - 4
  const circumference = 2 * Math.PI * radius

  const clamped = Math.min(100, Math.max(0, value))
  const dashOffset = (clamped / 100) * circumference

  const noTransition = value > prevValueRef.current + 5 && prevValueRef.current > 5
  prevValueRef.current = value

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transform: 'rotate(-90deg)'
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: gradient.start }} />
            <stop offset="100%" style={{ stopColor: gradient.end }} />
          </linearGradient>

          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={innerShadowId}>
            <feOffset dx="0" dy="1" />
            <feGaussianBlur stdDeviation="1" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="rgba(0,0,0,0.15)" floodOpacity="1" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke={`rgba(var(--hhc-glass-text), 0.12)`}
          filter={`url(#${innerShadowId})`}
        />

        <circle
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="transparent"
          stroke={`url(#${gradientId})`}
          filter={`url(#${glowFilterId})`}
          strokeLinecap="round"
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset: dashOffset,
            transition: noTransition ? 'none' : 'stroke-dashoffset 1s cubic-bezier(0.5, 0, 0, 1)',
            ...(isWarning ? { animation: 'progress-ring-blink 1s infinite' } : {})
          }}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {children}
      </div>
    </div>
  )
}
