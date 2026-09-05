import { Button as AriaButton } from 'react-aria-components'
import { useState } from 'react'
import { Baseline, ChevronDown, Highlighter } from 'lucide-react'
import { Popover } from '@renderer/components/Common/MenuPopover'
import { useTranslation } from 'react-i18next'
import type { EditablePresentationTheme } from '@renderer/lib/editable-presentation'

const STANDARD_COLORS = [
  '#c00000',
  '#ff0000',
  '#ffc000',
  '#ffff00',
  '#92d050',
  '#00b050',
  '#00b0f0',
  '#0070c0',
  '#002060',
  '#7030a0'
]
const HIGHLIGHT_COLORS = [
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#ff00ff',
  '#0000ff',
  '#ff0000',
  '#000080',
  '#008080',
  '#008000',
  '#800080',
  '#800000',
  '#808000',
  '#808080',
  '#c0c0c0',
  '#000000'
]

interface PresentationColorPaletteProps {
  kind: 'font' | 'highlight'
  value: string | null
  theme: EditablePresentationTheme
  disabled?: boolean
  onFinishFormatting?: () => void
  onChange: (color: string | null) => void
}

export default function PresentationColorPalette({
  kind,
  value,
  theme,
  disabled = false,
  onFinishFormatting,
  onChange
}: PresentationColorPaletteProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const changeOpen = (open: boolean): void => {
    setIsOpen(open)
    if (!open) onFinishFormatting?.()
  }
  const chooseColor = (color: string | null): void => {
    onChange(color)
    changeOpen(false)
  }
  const isFont = kind === 'font'
  const activeColor =
    value && value !== 'mixed' ? value : isFont ? theme.defaultTextStyle.color : '#ffff00'
  const colors = isFont ? createThemeColorGrid(theme) : HIGHLIGHT_COLORS
  return (
    <div className="flex h-7 items-center">
      <button
        type="button"
        className="relative inline-flex h-7 w-7 items-center justify-center rounded-l-md text-muted hover:bg-surface-secondary disabled:opacity-30"
        disabled={disabled}
        aria-label={
          isFont
            ? t('presentationWorkspace.fontColor', 'Font color')
            : t('presentationWorkspace.textHighlight', 'Text highlight color')
        }
        onClick={() => chooseColor(activeColor)}
      >
        {isFont ? <Baseline size={18} /> : <Highlighter size={18} />}
        <span
          className="absolute bottom-0.5 left-1/2 h-[3px] w-5 -translate-x-1/2"
          style={
            value === 'mixed'
              ? {
                  background: 'repeating-linear-gradient(90deg, #94a3b8 0 3px, transparent 3px 6px)'
                }
              : { backgroundColor: activeColor }
          }
        />
      </button>
      <Popover isOpen={isOpen} onOpenChange={changeOpen}>
        <AriaButton
          type="button"
          aria-label={
            isFont
              ? t('presentationWorkspace.fontColorMenu', 'Font color menu')
              : t('presentationWorkspace.textHighlightMenu', 'Text highlight color menu')
          }
          className="inline-flex h-7 w-4 items-center justify-center rounded-r-md text-muted hover:bg-surface-secondary disabled:opacity-30"
          isDisabled={disabled}
        >
          <ChevronDown size={12} />
        </AriaButton>
        <Popover.Content
          data-presentation-text-tool
          className="w-[396px] rounded-lg border border-separator bg-surface p-0 shadow-xl"
        >
          <Popover.Dialog className="p-2">
            {!isFont && (
              <button
                type="button"
                className="mb-2 h-9 w-full border border-separator text-sm hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => chooseColor(null)}
              >
                {t('presentationWorkspace.noColor', 'No Color')}
              </button>
            )}
            {isFont && (
              <p className="mb-2 text-sm font-semibold">
                {t('presentationWorkspace.themeColors', 'Theme Colors')}
              </p>
            )}
            <div className={`grid gap-1 ${isFont ? 'grid-cols-10' : 'grid-cols-5'}`}>
              {colors.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  type="button"
                  className={`rounded-sm p-0.5 focus-visible:outline-2 focus-visible:outline-accent ${
                    value?.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-accent' : ''
                  }`}
                  aria-label={`${
                    isFont
                      ? t('presentationWorkspace.fontColor', 'Font color')
                      : t('presentationWorkspace.textHighlight', 'Text highlight color')
                  } ${color}`}
                  aria-pressed={value?.toLowerCase() === color.toLowerCase()}
                  onClick={() => chooseColor(color)}
                >
                  <span
                    aria-hidden="true"
                    className={isFont ? 'block size-[18px]' : 'block size-9'}
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>
            {isFont && (
              <>
                <p className="mb-2 mt-4 text-sm font-semibold">
                  {t('presentationWorkspace.standardColors', 'Standard Colors')}
                </p>
                <div className="grid grid-cols-10 gap-1">
                  {STANDARD_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="rounded-sm p-0.5 focus-visible:outline-2 focus-visible:outline-accent"
                      aria-label={`${t('presentationWorkspace.fontColor', 'Font color')} ${color}`}
                      onClick={() => chooseColor(color)}
                    >
                      <span
                        aria-hidden="true"
                        className="block size-[18px]"
                        style={{ backgroundColor: color }}
                      />
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-separator pt-3 text-sm">
                  <input
                    type="color"
                    className="size-7"
                    aria-label={t('presentationWorkspace.moreColors', 'More Colors…')}
                    value={activeColor}
                    onChange={(event) => chooseColor(event.currentTarget.value)}
                  />
                  {t('presentationWorkspace.moreColors', 'More Colors…')}
                </label>
              </>
            )}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  )
}

function createThemeColorGrid(theme: EditablePresentationTheme): string[] {
  const slots = [
    'lt1',
    'dk1',
    'lt2',
    'dk2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6'
  ] as const
  const bases = slots.map((slot) => theme.colorScheme[slot])
  return [
    bases,
    ...[0.8, 0.6, 0.4, -0.25, -0.5].map((amount) => bases.map((color) => mixColor(color, amount)))
  ].flat()
}

function mixColor(color: string, amount: number): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color)
  if (!match) return color
  return `#${match
    .slice(1)
    .map((part) => {
      const value = Number.parseInt(part, 16)
      const next = amount >= 0 ? value + (255 - value) * amount : value * (1 + amount)
      return Math.round(next).toString(16).padStart(2, '0')
    })
    .join('')}`
}
