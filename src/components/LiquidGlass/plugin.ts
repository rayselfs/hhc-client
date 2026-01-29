import type { App, Plugin } from 'vue'
import { injectLiquidGlassFilters } from './composables/useLiquidGlassFilters'
import { applyTheme } from './styles/theme'
import type { LiquidGlassTheme } from './styles/theme'

import { LiquidBtn } from './LiquidBtn'
import { LiquidBtnToggle } from './LiquidBtnToggle'
import { LiquidChip } from './LiquidChip'
import { LiquidContainer } from './LiquidContainer'
import { LiquidDivider } from './LiquidDivider'
import { LiquidIcon } from './LiquidIcon'
import { LiquidProgress } from './LiquidProgress'
import { LiquidProgressCircular } from './LiquidProgressCircular'
import { LiquidTimerRing, LiquidProgressRing } from './LiquidTimerRing'
import { LiquidSearchBar } from './LiquidSearchBar'
import { LiquidSwitch } from './LiquidSwitch'
import { LiquidTextField } from './LiquidTextField'

export interface LiquidGlassPluginOptions {
  /** 是否自動註冊全域元件 (預設: true) */
  registerComponents?: boolean
  /** 自訂主題配置 */
  theme?: Partial<LiquidGlassTheme>
}

export const LiquidGlassPlugin: Plugin = {
  install(app: App, options: LiquidGlassPluginOptions = {}) {
    const { registerComponents = true, theme } = options

    // Inject theme CSS variables (with optional custom theme)
    applyTheme(theme)

    // Inject SVG filters for glass effects
    injectLiquidGlassFilters()

    if (registerComponents) {
      app.component('LiquidBtn', LiquidBtn)
      app.component('LiquidBtnToggle', LiquidBtnToggle)
      app.component('LiquidChip', LiquidChip)
      app.component('LiquidContainer', LiquidContainer)
      app.component('LiquidDivider', LiquidDivider)
      app.component('LiquidIcon', LiquidIcon)
      app.component('LiquidProgress', LiquidProgress)
      app.component('LiquidProgressCircular', LiquidProgressCircular)
      app.component('LiquidProgressRing', LiquidProgressRing)
      app.component('LiquidSearchBar', LiquidSearchBar)
      app.component('LiquidSwitch', LiquidSwitch)
      app.component('LiquidTextField', LiquidTextField)
      app.component('LiquidTimerRing', LiquidTimerRing)
    }
  },
}
