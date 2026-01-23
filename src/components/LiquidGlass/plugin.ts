import type { App, Plugin } from 'vue'
import { injectLiquidGlassFilters } from './composables/useLiquidGlassFilters'

import { LiquidBtn } from './LiquidBtn'
import { LiquidBtnToggle } from './LiquidBtnToggle'
import {
  LiquidCard,
  LiquidCardTitle,
  LiquidCardSubtitle,
  LiquidCardText,
  LiquidCardActions,
} from './LiquidCard'
import { LiquidChip } from './LiquidChip'
import { LiquidContainer } from './LiquidContainer'
import { LiquidDivider } from './LiquidDivider'
import { LiquidProgress } from './LiquidProgress'
import { LiquidProgressRing } from './LiquidProgressRing'
import { LiquidScrollArea } from './LiquidScrollArea'
import { LiquidSwitch } from './LiquidSwitch'
import { LiquidTextField } from './LiquidTextField'

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
      app.component('LiquidCard', LiquidCard)
      app.component('LiquidCardTitle', LiquidCardTitle)
      app.component('LiquidCardSubtitle', LiquidCardSubtitle)
      app.component('LiquidCardText', LiquidCardText)
      app.component('LiquidCardActions', LiquidCardActions)
      app.component('LiquidChip', LiquidChip)
      app.component('LiquidContainer', LiquidContainer)
      app.component('LiquidDivider', LiquidDivider)
      app.component('LiquidProgress', LiquidProgress)
      app.component('LiquidProgressRing', LiquidProgressRing)
      app.component('LiquidScrollArea', LiquidScrollArea)
      app.component('LiquidSwitch', LiquidSwitch)
      app.component('LiquidTextField', LiquidTextField)
    }
  },
}
