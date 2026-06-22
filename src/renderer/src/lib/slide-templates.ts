import type { SlideDocument, SlideTheme } from '@shared/types/slides'

export interface SlideTemplate {
  id: string
  name: string
  theme: SlideTheme
}

export const BUILT_IN_SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: 'dark-stage',
    name: 'Dark Stage',
    theme: {
      id: 'dark-stage',
      name: 'Dark Stage',
      fontFamily: 'Inter Variable',
      textColor: '#ffffff',
      backgroundColor: '#050505',
      accentColor: '#0ea5e9'
    }
  },
  {
    id: 'warm-sermon',
    name: 'Warm Sermon',
    theme: {
      id: 'warm-sermon',
      name: 'Warm Sermon',
      fontFamily: 'Noto Sans TC Variable',
      textColor: '#fff7ed',
      backgroundColor: '#1c140d',
      accentColor: '#f97316'
    }
  },
  {
    id: 'clean-light',
    name: 'Clean Light',
    theme: {
      id: 'clean-light',
      name: 'Clean Light',
      fontFamily: 'Inter Variable',
      textColor: '#111827',
      backgroundColor: '#f8fafc',
      accentColor: '#2563eb'
    }
  }
]

export function getSlideTemplate(templateId: string): SlideTemplate | null {
  return BUILT_IN_SLIDE_TEMPLATES.find((template) => template.id === templateId) ?? null
}

export function applySlideTemplate(
  document: SlideDocument,
  template: SlideTemplate
): SlideDocument {
  return {
    ...document,
    theme: template.theme,
    slides: document.slides.map((slide) => ({
      ...slide,
      background:
        slide.background.type === 'color'
          ? { type: 'color', color: template.theme.backgroundColor }
          : slide.background,
      elements: slide.elements.map((element) => {
        if (element.type !== 'text') return element
        return {
          ...element,
          style: {
            ...element.style,
            fontFamily: template.theme.fontFamily,
            color: template.theme.textColor
          }
        }
      })
    })),
    updatedAt: Date.now()
  }
}
