import type { ProjectionTheme } from '@shared/types/projection-theme'

export interface BibleProjectionTemplate {
  id: string
  name: string
  theme: ProjectionTheme
}

export const BUILT_IN_BIBLE_PROJECTION_TEMPLATES: BibleProjectionTemplate[] = [
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

export function getBibleProjectionTemplate(templateId: string): BibleProjectionTemplate | null {
  return BUILT_IN_BIBLE_PROJECTION_TEMPLATES.find((template) => template.id === templateId) ?? null
}
