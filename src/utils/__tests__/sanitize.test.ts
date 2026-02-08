import { describe, it, expect } from 'vitest'
import { sanitizeHTML } from '../sanitize'

describe('sanitizeHTML', () => {
  it('should strip script tags', () => {
    const malicious = '<script>alert("xss")</script>Hello'
    const result = sanitizeHTML(malicious)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
    expect(result).toContain('Hello')
  })

  it('should strip iframe tags', () => {
    const malicious = '<iframe src="evil.com"></iframe>Text'
    const result = sanitizeHTML(malicious)
    expect(result).not.toContain('<iframe>')
    expect(result).not.toContain('evil.com')
    expect(result).toContain('Text')
  })

  it('should strip onerror attribute from img tags', () => {
    const malicious = '<img src="x" onerror="alert(\'xss\')">Text'
    const result = sanitizeHTML(malicious)
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('alert')
  })

  it('should strip onclick and other event handlers', () => {
    const malicious = '<div onclick="alert(\'xss\')">Click me</div>'
    const result = sanitizeHTML(malicious)
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('alert')
    expect(result).toContain('Click me')
  })

  it('should preserve br tags', () => {
    const safe = 'Line 1<br>Line 2'
    const result = sanitizeHTML(safe)
    expect(result).toContain('<br>')
    expect(result).toContain('Line 1')
    expect(result).toContain('Line 2')
  })

  it('should preserve b and i tags', () => {
    const safe = '<b>Bold</b> and <i>Italic</i>'
    const result = sanitizeHTML(safe)
    expect(result).toContain('<b>Bold</b>')
    expect(result).toContain('<i>Italic</i>')
  })

  it('should preserve span tags with class and style attributes', () => {
    const safe = '<span class="highlight" style="color: red;">Highlighted</span>'
    const result = sanitizeHTML(safe)
    expect(result).toContain('<span')
    expect(result).toContain('class="highlight"')
    expect(result).toContain('style="color: red;"')
    expect(result).toContain('Highlighted')
  })

  it('should preserve em and strong tags', () => {
    const safe = '<em>Emphasis</em> and <strong>Strong</strong>'
    const result = sanitizeHTML(safe)
    expect(result).toContain('<em>Emphasis</em>')
    expect(result).toContain('<strong>Strong</strong>')
  })

  it('should preserve text content when stripping malicious tags', () => {
    const malicious = '<script>alert("xss")</script>Important Text<iframe src="evil"></iframe>'
    const result = sanitizeHTML(malicious)
    expect(result).toContain('Important Text')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('<iframe>')
  })

  it('should handle empty strings', () => {
    const result = sanitizeHTML('')
    expect(result).toBe('')
  })

  it('should handle mixed safe and unsafe content', () => {
    const mixed = '<b>Safe</b><script>alert("bad")</script><i>Also Safe</i>'
    const result = sanitizeHTML(mixed)
    expect(result).toContain('<b>Safe</b>')
    expect(result).toContain('<i>Also Safe</i>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
  })

  it('should strip javascript: protocol from href attributes', () => {
    const malicious = '<a href="javascript:alert(\'xss\')">Click</a>'
    const result = sanitizeHTML(malicious)
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('alert')
  })
})
