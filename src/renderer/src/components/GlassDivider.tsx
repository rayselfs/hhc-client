interface GlassDividerProps {
  vertical?: boolean
  thickness?: number
  className?: string
}

export default function GlassDivider({
  vertical = false,
  thickness = 1,
  className
}: GlassDividerProps): React.JSX.Element {
  const color = 'var(--separator)'

  const style: React.CSSProperties = vertical
    ? {
        width: `${thickness}px`,
        maxWidth: `${thickness}px`,
        alignSelf: 'stretch',
        minHeight: '100%',
        background: `linear-gradient(180deg, transparent 0%, ${color} 20%, ${color} 80%, transparent 100%)`
      }
    : {
        height: `${thickness}px`,
        maxHeight: `${thickness}px`,
        width: '100%',
        minWidth: '100%',
        background: `linear-gradient(90deg, transparent 0%, ${color} 20%, ${color} 80%, transparent 100%)`
      }

  return <hr style={style} className={`block flex-none border-none m-0 ${className ?? ''}`} />
}
