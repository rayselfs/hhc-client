import '@mdi/font/css/materialdesignicons.css' // MDI Icons
import 'vuetify/styles' // Vuetify Core CSS

// Composables
import { createVuetify } from 'vuetify'

// 主題配置
// export default createVuetify({})
const lightTheme = {
  dark: false,
  colors: {
    primary: '#1976D2',
    secondary: '#424242',
    accent: '#82B1FF',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
  },
}

const darkTheme = {
  dark: true,
  colors: {
    primary: '#a8c7fa',
    secondary: '#424242',
    accent: '#FF4081',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#7e5700',
  },
}

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: lightTheme,
      dark: darkTheme,
    },
  },
})
