/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Electron Forge Vite plugin types
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string

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
