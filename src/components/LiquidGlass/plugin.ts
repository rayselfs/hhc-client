import type { App, Plugin } from 'vue'
import { injectLiquidGlassFilters } from './composables/useLiquidGlassFilters'

import { LiquidBtn } from './LiquidBtn'
import { LiquidBtnToggle } from './LiquidBtnToggle'
import { LiquidContainer } from './LiquidContainer'
import { LiquidProgress } from './LiquidProgress'

export interface LiquidGlassPluginOptions {
  registerComponents?: boolean
}

export const LiquidGlassPlugin: Plugin = {
  install(app: App, options: LiquidGlassPluginOptions = {}) {
    const { registerComponents = true } = options

    injectLiquidGlassFilters()

    if (registerComponents) {
      app.component('LiquidBtn', LiquidBtn)
      app.component('LiquidBtnToggle', LiquidBtnToggle)
      app.component('LiquidContainer', LiquidContainer)
      app.component('LiquidProgress', LiquidProgress)
    }
  },
}
