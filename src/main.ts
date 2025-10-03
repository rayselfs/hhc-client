import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './plugins/i18n'
import vuetify from './plugins/vuetify'

// css
import 'normalize.css'
import './assets/main.css'

// font
import '@fontsource-variable/open-sans'
import '@fontsource-variable/noto-sans-tc'
import '@fontsource-variable/roboto'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(vuetify)
app.mount('#app')
