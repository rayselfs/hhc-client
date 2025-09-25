/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TIMER_DEFAULT_DURATION: string
  readonly VITE_TIMER_DEFAULT_MODE: string
  readonly VITE_TIMER_DEFAULT_TIMEZONE: string
  readonly VITE_PROJECTION_DEFAULT_VIEW: string
  readonly VITE_PROJECTION_DEFAULT_SHOW_DEFAULT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
