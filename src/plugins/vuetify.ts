import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'

// Theme configuration
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
  display: {
    thresholds: {
      xs: 0,
      sm: 600,
      md: 1060,
      lg: 1280,
      xl: 1920,
      xxl: 2560,
    },
  },
})
