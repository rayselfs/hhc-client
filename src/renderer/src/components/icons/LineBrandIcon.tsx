import lineBrandIcon from '@renderer/assets/line-brand-icon.png'

// Official source page: https://www.line.me/en/logo
// The PC icon is 20px; the required 1X clear space is half its size on every side.
export function LineBrandIcon(): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0" style={{ padding: 10 }}>
      <img src={lineBrandIcon} alt="LINE" width={20} height={20} className="size-5 max-w-none" />
    </span>
  )
}
