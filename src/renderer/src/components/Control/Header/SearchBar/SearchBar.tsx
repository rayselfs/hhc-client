import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Search } from 'lucide-react'

export interface SearchBarProps {
  onSearch: (query: string) => void
  onClear: () => void
  placeholder: string
  submitLabel: string
  disabled?: boolean
  /** e.g. 'data-bible-search' — sets a data attribute on the input for external focus via querySelector */
  inputDataAttr?: string
  testId?: string
}

export default function SearchBar({
  onSearch,
  onClear,
  placeholder,
  submitLabel,
  disabled = false,
  inputDataAttr,
  testId
}: SearchBarProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [query, setQuery] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const collapse = useCallback((): void => {
    setIsExpanded(false)
    setQuery('')
    onClear()
  }, [onClear])

  const collapseUI = useCallback((): void => {
    setIsExpanded(false)
    setQuery('')
  }, [])

  const handleSubmit = useCallback((): void => {
    const trimmed = query.trim()
    if (!trimmed) {
      collapse()
      return
    }
    onSearch(trimmed)
    collapseUI()
  }, [query, onSearch, collapse, collapseUI])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleSubmit()
    } else if (e.key === 'Escape') {
      collapse()
    }
  }

  const handleToggle = (): void => {
    if (disabled) return
    if (isExpanded) {
      collapse()
    } else {
      setIsExpanded(true)
    }
  }

  useEffect(() => {
    if (!isExpanded) return
    const timer = setTimeout(() => inputRef.current?.focus(), 200)
    return () => clearTimeout(timer)
  }, [isExpanded])

  useEffect(() => {
    if (!isExpanded) return
    const handleMouseDown = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        collapse()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isExpanded, collapse])

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> & Record<string, string> = {}
  if (inputDataAttr) {
    inputProps[inputDataAttr] = ''
  }

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={`relative h-10 transition-[width] duration-250 ease-in-out rounded-full border border-border ${
        isExpanded ? 'w-64' : 'w-10'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`w-full h-full bg-transparent text-sm text-foreground pl-5 pr-10 outline-none placeholder:text-muted-fg transition-opacity duration-200 ${
          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        {...inputProps}
      />
      <button
        type="button"
        onClick={isExpanded ? handleSubmit : handleToggle}
        disabled={disabled}
        aria-label={isExpanded ? submitLabel : placeholder}
        className={`absolute right-0 -top-0.5 flex items-center justify-center w-10 h-10 text-muted-fg transition-colors ${
          isExpanded
            ? 'hover:text-foreground'
            : 'hover:text-foreground hover:bg-default-100 rounded-full'
        }`}
      >
        <Search size={16} />
      </button>
    </div>
  )
}
