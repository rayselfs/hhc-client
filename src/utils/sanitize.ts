import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param html - Raw HTML string
 * @returns Sanitized HTML string with only safe tags and attributes
 */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'span', 'p', 'div', 'sup', 'sub'],
    ALLOWED_ATTR: ['class', 'style'],
  })
}
