import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Composables
import { createVuetify } from 'vuetify'

// Theme configuration
const lightTheme = {
  dark: false,
  colors: {
    primary: '#c1e7ff',
    secondary: '#424242',
    accent: '#82B1FF',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FFC107',
    surface: '#f0f4f9',
  },
}

const darkTheme = {
  dark: true,
  colors: {
    primary: '#004a77',
    secondary: '#424242',
    accent: '#FF4081',
    error: '#FF5252',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#7e5700',
    surface: '#1e1f20',
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
