import lineBrandIcon from '@renderer/assets/line-brand-icon.png'

export interface LineBrandIconProps {
  className?: string
}

// Official source page: https://www.line.me/en/logo
export function LineBrandIcon({ className }: LineBrandIconProps): React.JSX.Element {
  return (
    <span className={`inline-flex isolate shrink-0 ${className ?? ''}`}>
      <img src={lineBrandIcon} alt="LINE" width={20} height={20} className="size-5 max-w-none" />
    </span>
  )
}
