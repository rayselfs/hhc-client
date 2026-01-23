import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './plugins/i18n'
import vuetify from './plugins/vuetify'
import * as Sentry from '@sentry/vue'
import { LiquidGlassPlugin } from '@/components/LiquidGlass'

// css
import 'normalize.css'
import './assets/main.css'

// font
import '@fontsource-variable/open-sans'
import '@fontsource-variable/noto-sans-tc'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/roboto'

import App from './App.vue'
import router from './router'

const app = createApp(App)

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    sendDefaultPii: true,
    beforeSend(event) {
      // Only send errors in production or when explicitly enabled
      if (import.meta.env.MODE === 'development' && !import.meta.env.VITE_SENTRY_ENABLED) {
        return null
      }
      return event
    },
  })
}

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(vuetify)
app.use(LiquidGlassPlugin, { registerComponents: false })
app.mount('#app')
