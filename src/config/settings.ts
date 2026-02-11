export const VIDEO_QUALITY_OPTIONS = [
  {
    text: 'settings.videoQualityOptions.high',
    value: 'high',
    description: 'settings.videoQualityOptions.highDesc',
  },
  {
    text: 'settings.videoQualityOptions.medium',
    value: 'medium',
    description: 'settings.videoQualityOptions.mediumDesc',
  },
  {
    text: 'settings.videoQualityOptions.low',
    value: 'low',
    description: 'settings.videoQualityOptions.lowDesc',
  },
]

export const CATEGORIES = [
  { id: 'general', title: 'settings.categories.general', icon: 'mdi-cog' },
  { id: 'media', title: 'settings.categories.media', icon: 'mdi-video' },
  { id: 'system', title: 'settings.categories.system', icon: 'mdi-tune' },
] as const

export const getTimezoneOptions = (t: (key: string) => string) => [
  { title: t('timezones.taipei'), value: 'Asia/Taipei' },
  { title: t('timezones.hongKong'), value: 'Asia/Hong_Kong' },
  { title: t('timezones.singapore'), value: 'Asia/Singapore' },
  { title: t('timezones.tokyo'), value: 'Asia/Tokyo' },
  { title: t('timezones.seoul'), value: 'Asia/Seoul' },
  { title: t('timezones.newYork'), value: 'America/New_York' },
  { title: t('timezones.london'), value: 'Europe/London' },
  { title: t('timezones.paris'), value: 'Europe/Paris' },
  { title: t('timezones.utc'), value: 'UTC' },
]
