import { Button as AriaButton } from 'react-aria-components'
import { useEffect, useState } from 'react'
import { ListBox } from '@heroui/react/list-box'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CaseSensitive,
  ChevronDown,
  Eraser,
  Expand,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  WrapText
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover } from '@heroui/react/popover'
import type {
  EditablePresentationTheme,
  EditableTextAlign,
  EditableTextStyle
} from '@renderer/lib/editable-presentation'
import PresentationColorPalette from './PresentationColorPalette'
import type { TextCase } from '@renderer/lib/presentation-rich-text'

const CONTROL =
  'inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-transparent px-1.5 text-default-500 hover:border-divider hover:bg-content2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30'
const ACTIVE = 'border-primary bg-primary text-white hover:bg-primary/90 hover:text-white'
type ToggleState = boolean | 'mixed'

interface PresentationHomeRibbonProps {
  disabled: boolean
  onFinishFormatting?: () => void
  fontFamilies: string[]
  documentFonts?: string[]
  recentFonts?: string[]
  localFonts?: string[]
  localFontStatus?: 'idle' | 'loading' | 'ready' | 'failed' | 'unsupported'
  fontFamily: string
  fontSize: number | 'mixed'
  bold: ToggleState
  italic: ToggleState
  underline: ToggleState
  strikethrough: ToggleState
  baseline: EditableTextStyle['baseline'] | 'mixed'
  color: string
  highlightColor: string | null
  align: EditableTextAlign | 'mixed'
  theme: EditablePresentationTheme
  onFontFamilyChange: (value: string) => void
  onFontAccess?: () => void
  onFontSizeChange: (value: number) => void
  onGrowFont: () => void
  onShrinkFont: () => void
  onCharacterStyle: (patch: Partial<EditableTextStyle>) => void
  onChangeCase: (textCase: TextCase) => void
  onReset: () => void
  onAlign: (align: EditableTextAlign) => void
  onBullets: (char?: string) => void
  onNumbering: (format?: string) => void
  onDecreaseIndent: () => void
  onIncreaseIndent: () => void
  onLineSpacing: () => void
  onLineSpacingValue?: (value: number) => void
  lineSpacing?: number | 'mixed'
  characterSpacing?: number | 'mixed'
  bullets?: ToggleState
  numbering?: ToggleState
  onAutoWidth: () => void
}

export default function PresentationHomeRibbon(
  props: PresentationHomeRibbonProps
): React.JSX.Element {
  const { t } = useTranslation()
  const iconButton = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    active: ToggleState = false,
    key?: React.Key
  ): React.JSX.Element => (
    <button
      key={key}
      type="button"
      className={`${CONTROL} ${active === true ? ACTIVE : ''}`}
      disabled={props.disabled}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon}
    </button>
  )
  return (
    <section
      role="group"
      aria-label={t('presentationWorkspace.textFormatting', 'Text formatting')}
      data-testid="presentation-ribbon-group"
      className="grid h-full w-[720px] shrink-0 grid-rows-2 gap-1 border-r border-divider px-2 py-1"
    >
      <div className="flex items-center gap-1">
        <FontFamilyPicker {...props} />
        <FontSizeInput
          value={props.fontSize}
          disabled={props.disabled}
          onChange={props.onFontSizeChange}
          onFinish={props.onFinishFormatting}
        />
        {iconButton(
          t('presentationWorkspace.increaseFontSize', 'Increase font size'),
          <span className="text-lg">A⌃</span>,
          props.onGrowFont
        )}
        {iconButton(
          t('presentationWorkspace.decreaseFontSize', 'Decrease font size'),
          <span className="text-sm">A⌄</span>,
          props.onShrinkFont
        )}
        <span className="mx-1 h-6 w-px bg-divider" />
        {iconButton(
          t('presentationWorkspace.clearFormatting', 'Clear formatting'),
          <Eraser size={18} />,
          props.onReset
        )}
        <span className="mx-1 h-6 w-px bg-divider" />
        <SplitFormattingMenu
          onFinishFormatting={props.onFinishFormatting}
          label={t('presentationWorkspace.bullets', 'Bullets')}
          icon={<List size={18} />}
          disabled={props.disabled}
          active={props.bullets}
          onAction={() => props.onBullets()}
          items={['•', '◦', '▪'].map((char) => ({
            id: char,
            label: char,
            action: () => props.onBullets(char)
          }))}
        />
        <SplitFormattingMenu
          onFinishFormatting={props.onFinishFormatting}
          label={t('presentationWorkspace.numbering', 'Numbering')}
          icon={<ListOrdered size={18} />}
          disabled={props.disabled}
          active={props.numbering}
          onAction={() => props.onNumbering()}
          items={[
            ['arabicPeriod', '1. 2. 3.'],
            ['alphaLcParenR', 'a) b) c)'],
            ['romanUcPeriod', 'I. II. III.']
          ].map(([format, label]) => ({
            id: format,
            label,
            action: () => props.onNumbering(format)
          }))}
        />
        {iconButton(
          t('presentationWorkspace.decreaseIndent', 'Decrease indent'),
          <IndentDecrease size={18} />,
          props.onDecreaseIndent
        )}
        {iconButton(
          t('presentationWorkspace.increaseIndent', 'Increase indent'),
          <IndentIncrease size={18} />,
          props.onIncreaseIndent
        )}
        <FormattingMenu
          label={t('presentationWorkspace.lineSpacing', 'Line spacing')}
          icon={<WrapText size={18} />}
          disabled={props.disabled}
          onFinishFormatting={props.onFinishFormatting}
          items={[
            ...[1, 1.15, 1.5, 2].map((value) => ({
              id: String(value),
              label: String(value),
              active: props.lineSpacing === value,
              action: () => props.onLineSpacingValue?.(value)
            })),
            {
              id: 'options',
              label: t('presentationWorkspace.lineSpacingOptions', 'Line Spacing Options...'),
              action: props.onLineSpacing
            }
          ]}
        />
      </div>
      <div className="flex items-center gap-1">
        {iconButton(
          t('presentationWorkspace.bold', 'Bold'),
          <Bold size={18} />,
          () => props.onCharacterStyle({ bold: props.bold !== true }),
          props.bold
        )}
        {iconButton(
          t('presentationWorkspace.italic', 'Italic'),
          <Italic size={18} />,
          () => props.onCharacterStyle({ italic: props.italic !== true }),
          props.italic
        )}
        {iconButton(
          t('presentationWorkspace.underline', 'Underline'),
          <Underline size={18} />,
          () => props.onCharacterStyle({ underline: props.underline !== true }),
          props.underline
        )}
        {iconButton(
          t('presentationWorkspace.strikethrough', 'Strikethrough'),
          <Strikethrough size={18} />,
          () => props.onCharacterStyle({ strikethrough: props.strikethrough !== true }),
          props.strikethrough
        )}
        {iconButton(
          t('presentationWorkspace.superscript', 'Superscript'),
          <Superscript size={18} />,
          () =>
            props.onCharacterStyle({
              baseline: props.baseline === 'superscript' ? 'normal' : 'superscript'
            }),
          props.baseline === 'mixed' ? 'mixed' : props.baseline === 'superscript'
        )}
        {iconButton(
          t('presentationWorkspace.subscript', 'Subscript'),
          <Subscript size={18} />,
          () =>
            props.onCharacterStyle({
              baseline: props.baseline === 'subscript' ? 'normal' : 'subscript'
            }),
          props.baseline === 'mixed' ? 'mixed' : props.baseline === 'subscript'
        )}
        <FormattingMenu
          onFinishFormatting={props.onFinishFormatting}
          label={t('presentationWorkspace.characterSpacing', 'Character spacing')}
          icon={<span className="text-sm">AV↔</span>}
          disabled={props.disabled}
          items={[
            ['normal', t('presentationWorkspace.spacingNormal', 'Normal'), 0],
            ['tight', t('presentationWorkspace.spacingTight', 'Tight'), -0.5],
            ['loose', t('presentationWorkspace.spacingLoose', 'Loose'), 1.5],
            ['very-loose', t('presentationWorkspace.spacingVeryLoose', 'Very Loose'), 3]
          ].map(([id, label, value]) => ({
            id: String(id),
            label: String(label),
            active: props.characterSpacing === Number(value),
            action: () => props.onCharacterStyle({ characterSpacing: Number(value) })
          }))}
        />
        <FormattingMenu
          onFinishFormatting={props.onFinishFormatting}
          label={t('presentationWorkspace.changeCase', 'Change case')}
          icon={<CaseSensitive size={19} />}
          disabled={props.disabled}
          items={[
            ['sentence', t('presentationWorkspace.sentenceCase', 'Sentence case')],
            ['lower', t('presentationWorkspace.lowercase', 'lowercase')],
            ['upper', t('presentationWorkspace.uppercase', 'UPPERCASE')],
            ['capitalize', t('presentationWorkspace.capitalizeEachWord', 'Capitalize Each Word')],
            ['toggle', t('presentationWorkspace.toggleCase', 'tOGGLE cASE')]
          ].map(([textCase, label]) => ({
            id: textCase,
            label,
            action: () => props.onChangeCase(textCase as TextCase)
          }))}
        />
        <span className="mx-1 h-6 w-px bg-divider" />
        <PresentationColorPalette
          onFinishFormatting={props.onFinishFormatting}
          kind="highlight"
          value={props.highlightColor}
          theme={props.theme}
          disabled={props.disabled}
          onChange={(highlightColor) => props.onCharacterStyle({ highlightColor })}
        />
        <PresentationColorPalette
          onFinishFormatting={props.onFinishFormatting}
          kind="font"
          value={props.color}
          theme={props.theme}
          disabled={props.disabled}
          onChange={(color) => color && props.onCharacterStyle({ color })}
        />
        <span className="mx-1 h-6 w-px bg-divider" />
        {(
          [
            ['left', 'Align Left', AlignLeft],
            ['center', 'Center', AlignCenter],
            ['right', 'Align Right', AlignRight],
            ['justify', 'Justify', AlignJustify]
          ] as const
        ).map(([align, label, Icon]) =>
          iconButton(
            t(`presentationWorkspace.align.${align}`, label),
            <Icon size={18} />,
            () => props.onAlign(align),
            props.align === 'mixed' ? 'mixed' : props.align === align,
            align
          )
        )}
        {iconButton(
          t('presentationWorkspace.autoWidth', 'Auto width'),
          <Expand size={18} />,
          props.onAutoWidth
        )}
      </div>
    </section>
  )
}

function FormattingMenu({
  label,
  icon,
  disabled,
  onFinishFormatting,
  items
}: {
  label: string
  icon: React.ReactNode
  disabled: boolean
  onFinishFormatting?: () => void
  items: Array<{ id: string; label: string; active?: ToggleState; action: () => void }>
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const changeOpen = (open: boolean): void => {
    setIsOpen(open)
    if (!open) onFinishFormatting?.()
  }
  return (
    <Popover isOpen={isOpen} onOpenChange={changeOpen}>
      <AriaButton type="button" className={CONTROL} isDisabled={disabled} aria-label={label}>
        {icon}
        <ChevronDown size={11} />
      </AriaButton>
      <Popover.Content
        data-presentation-text-tool
        className="rounded-lg border border-divider bg-content1 p-1 shadow-xl"
      >
        <Popover.Dialog className="grid min-w-44 gap-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              aria-pressed={item.active}
              type="button"
              className="rounded-md px-3 py-1.5 text-left text-sm hover:bg-content2 focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => {
                item.action()
                changeOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

function SplitFormattingMenu({
  label,
  icon,
  disabled,
  onAction,
  active,
  onFinishFormatting,
  items
}: {
  label: string
  icon: React.ReactNode
  disabled: boolean
  active?: ToggleState
  onAction: () => void
  onFinishFormatting?: () => void
  items: Array<{ id: string; label: string; active?: ToggleState; action: () => void }>
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const changeOpen = (open: boolean): void => {
    setIsOpen(open)
    if (!open) onFinishFormatting?.()
  }
  return (
    <div className="flex h-7 items-center">
      <button
        type="button"
        className={`${CONTROL} rounded-r-none ${active === true ? ACTIVE : ''}`}
        aria-pressed={active}
        disabled={disabled}
        aria-label={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onAction}
      >
        {icon}
      </button>
      <Popover isOpen={isOpen} onOpenChange={changeOpen}>
        <AriaButton
          type="button"
          className={`${CONTROL} min-w-4 rounded-l-none px-0`}
          isDisabled={disabled}
          aria-label={`${label} menu`}
        >
          <ChevronDown size={11} />
        </AriaButton>
        <Popover.Content
          data-presentation-text-tool
          className="rounded-lg border border-divider bg-content1 p-1 shadow-xl"
        >
          <Popover.Dialog className="flex gap-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="min-w-14 rounded-md border border-divider px-3 py-2 text-sm hover:bg-content2 focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => {
                  item.action()
                  changeOpen(false)
                }}
              >
                {item.label}
              </button>
            ))}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  )
}

function FontSizeInput({
  value,
  disabled,
  onChange,
  onFinish
}: {
  value: number | 'mixed'
  disabled: boolean
  onChange: (value: number) => void
  onFinish?: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const label = value === 'mixed' ? '' : String(Math.round(value * 100) / 100)
  const [draft, setDraft] = useState(label)
  useEffect(() => setDraft(label), [label])
  const apply = (): void => {
    const size = Number(draft)
    if (Number.isFinite(size) && size > 0 && size !== value) onChange(size)
    else setDraft(label)
  }
  return (
    <input
      aria-label={t('presentationWorkspace.fontSize', 'Font size')}
      className="h-7 w-16 rounded-md border border-divider bg-content2 px-2 text-sm"
      inputMode="decimal"
      disabled={disabled}
      value={draft}
      placeholder={t('presentationWorkspace.mixed', 'Mixed')}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={apply}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          apply()
          onFinish?.()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(label)
          onFinish?.()
        }
      }}
    />
  )
}

function FontFamilyPicker(props: PresentationHomeRibbonProps): React.JSX.Element {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const changeOpen = (open: boolean): void => {
    setIsOpen(open)
    if (open) {
      setQuery('')
      props.onFontAccess?.()
    } else props.onFinishFormatting?.()
  }
  return (
    <Popover isOpen={isOpen} onOpenChange={changeOpen}>
      <AriaButton
        aria-label={t('presentationWorkspace.fontFamily', 'Font family')}
        className="flex h-7 w-44 items-center justify-between gap-2 rounded-md border border-divider bg-content2 px-2 text-sm"
        isDisabled={props.disabled}
      >
        <span className="truncate">
          {props.fontFamily === 'mixed'
            ? t('presentationWorkspace.mixed', 'Mixed')
            : props.fontFamily}
        </span>
        <ChevronDown size={12} />
      </AriaButton>
      <Popover.Content
        data-presentation-text-tool
        className="w-80 rounded-lg border border-divider bg-content1 p-0 shadow-xl"
      >
        <Popover.Dialog className="p-2">
          <input
            aria-label={t('presentationWorkspace.searchFonts', 'Search fonts')}
            placeholder={t('presentationWorkspace.searchFonts', 'Search fonts')}
            className="mb-2 h-8 w-full rounded border border-divider bg-content2 px-2 text-sm"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                event.currentTarget
                  .closest('[role="dialog"]')
                  ?.querySelector<HTMLElement>('[role="option"]')
                  ?.focus()
              }
            }}
          />
          {props.localFontStatus === 'loading' && (
            <p role="status" className="px-3 py-2 text-xs text-muted">
              {t('presentationWorkspace.fontsLoading', 'Loading local fonts…')}
            </p>
          )}
          {props.localFontStatus === 'unsupported' && (
            <p className="px-3 py-2 text-xs text-muted">
              {t(
                'presentationWorkspace.fontsUnsupported',
                'This environment cannot list installed fonts.'
              )}
            </p>
          )}
          {props.localFontStatus === 'failed' && (
            <button
              type="button"
              className="px-3 py-2 text-sm underline"
              onClick={props.onFontAccess}
            >
              {t('presentationWorkspace.fontsRetry', 'Retry local fonts')}
            </button>
          )}

          <ListBox
            aria-label={t('presentationWorkspace.fontFamily', 'Font family')}
            className="max-h-64 overflow-auto"
            selectionMode="single"
            selectedKeys={new Set(props.fontFamily === 'mixed' ? [] : [props.fontFamily])}
            onSelectionChange={(keys) => {
              if (keys === 'all') return
              const font = keys.values().next().value
              if (typeof font === 'string') {
                props.onFontFamilyChange(font)
                changeOpen(false)
              }
            }}
          >
            {props.fontFamilies
              .filter((font) => font.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
              .map((font) => {
                const bundled = [
                  'Inter Variable',
                  'Noto Sans TC Variable',
                  'Noto Sans SC Variable'
                ].includes(font)
                const missing =
                  props.localFontStatus === 'ready' && !bundled && !props.localFonts?.includes(font)
                const category = props.recentFonts?.includes(font)
                  ? t('presentationWorkspace.fontsRecent', 'Recent')
                  : props.documentFonts?.includes(font)
                    ? t('presentationWorkspace.fontsDocument', 'Document')
                    : ''
                return (
                  <ListBox.Item
                    key={font}
                    id={font}
                    textValue={font}
                    className="flex items-center justify-between gap-4"
                  >
                    <span style={{ fontFamily: JSON.stringify(font) }}>{font}</span>
                    <span className="text-xs text-muted">
                      {missing
                        ? t('presentationWorkspace.fontMissing', 'Unavailable · using fallback')
                        : category}
                    </span>
                  </ListBox.Item>
                )
              })}
          </ListBox>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
