import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './plugins/i18n'
import vuetify from './plugins/vuetify'
import errorHandler from './composables/useErrorHandler'

import 'normalize.css'
import './assets/main.css'

import '@fontsource-variable/open-sans'
import '@fontsource-variable/noto-sans-tc'
import '@fontsource-variable/roboto'

import App from './App.vue'
import router from './router'

const app = createApp(App)

// 全局錯誤處理
app.config.errorHandler = (error, instance, info) => {
  errorHandler.handleError(
    error as Error,
    {
      showNotification: true,
      logToConsole: true,
      reportToServer: true,
    },
    `Vue Error: ${info}`,
  )
}

// 全局未捕獲的 Promise 錯誤處理
window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handleError(
    event.reason,
    {
      showNotification: true,
      logToConsole: true,
      reportToServer: true,
    },
    'Unhandled Promise Rejection',
  )
})

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(vuetify)
app.mount('#app')
