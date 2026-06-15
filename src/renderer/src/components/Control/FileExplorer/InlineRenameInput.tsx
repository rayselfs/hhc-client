import { useEffect, useRef, useState } from 'react'

interface InlineRenameInputProps {
  initialValue: string
  ariaLabel: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InlineRenameInput({
  initialValue,
  ariaLabel,
  onSubmit,
  onCancel
}: InlineRenameInputProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const composingRef = useRef(false)
  const submittedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = (): void => {
    if (submittedRef.current) return
    submittedRef.current = true
    onSubmit(value)
  }

  const cancel = (): void => {
    submittedRef.current = true
    onCancel()
  }

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      value={value}
      className="w-full rounded border border-primary/40 bg-background px-1 text-center text-sm text-foreground outline-none"
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={submit}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={() => {
        composingRef.current = false
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
          return
        }
        if (event.key === 'Enter' && !composingRef.current) {
          event.preventDefault()
          submit()
        }
      }}
    />
  )
}
