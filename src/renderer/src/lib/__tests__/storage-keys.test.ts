import { describe, it, expect } from 'vitest'
import { STORAGE_PREFIX, createStorageKey } from '../utils'

describe('createStorageKey', () => {
  it('returns hhc-theme for theme', () => {
    expect(createStorageKey('theme')).toBe('hhc-theme')
  })

  it('returns hhc-language for language', () => {
    expect(createStorageKey('language')).toBe('hhc-language')
  })

  it('returns hhc- for empty string', () => {
    expect(createStorageKey('')).toBe('hhc-')
  })

  it('STORAGE_PREFIX is hhc-', () => {
    expect(STORAGE_PREFIX).toBe('hhc-')
  })
})
