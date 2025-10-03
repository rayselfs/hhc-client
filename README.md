# HHC Client

> A desktop application based on Electron + Vue 3, providing timer, Bible reader, and projection features

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%5E20.19.0%20%7C%7C%20%3E%3D22.12.0-brightgreen.svg)](package.json)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.5.22-4FC08D.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.0-3178C6.svg)](https://www.typescriptlang.org/)

## 📖 Project Overview

HHC Client is a feature-rich desktop application designed for churches and religious activities. It provides a modern user interface with multi-language support (Traditional Chinese, English) and includes the following core features:

- ⏰ **Timer Features** - Countdown and count-up timers
- 📖 **Bible Reader** - Support for Bible content browsing and projection
- 🖥️ **Projection Mode** - Dedicated projection window suitable for gatherings
- 🌙 **Dark Mode** - Support for light/dark theme switching
- 🌍 **Internationalization** - Multi-language support
- 🔄 **Auto Update** - Built-in automatic update mechanism

## ✨ Features

### Timer Functionality

- Countdown and count-up timers
- Circular progress bar display
- Customizable time settings
- Projection mode optimized display

### Bible Reader

- Bible content browsing
- Projection mode support
- Clear text display

### Projection Features

- Independent projection window
- Full-screen display
- Automatic screen resolution adaptation
- Support for multiple projection content types

### User Interface

- Modern design based on Vuetify 3
- Responsive layout
- Dark/light themes
- Traditional Chinese and English support

## 🛠️ Tech Stack

### Frontend Framework

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast frontend build tool
- **Vuetify 3** - Material Design component library

### Desktop Application

- **Electron** - Cross-platform desktop application framework
- **Electron Builder** - Application packaging tool
- **Electron Updater** - Automatic update functionality

### Development Tools

- **ESLint** - Code quality checking
- **Prettier** - Code formatting
- **Vitest** - Unit testing framework
- **Vue Test Utils** - Vue component testing utilities

### Additional Features

- **Vue I18n** - Internationalization support
- **Pinia** - State management
- **Vue Router** - Route management
- **Axios** - HTTP client

## 📋 System Requirements

- **Node.js**: ^20.19.0 || >=22.12.0
- **Operating Systems**:
  - macOS (Intel/Apple Silicon)
  - Windows (x64)
  - Linux (x64)

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

This will start the development server and launch the Electron application.

### Build Application

```bash
# Build for all platforms
npm run build

# Build for specific platforms
npm run electron:build:mac-arm      # macOS Apple Silicon
npm run electron:build:mac-intel    # macOS Intel
npm run electron:build:mac-universal # macOS Universal
npm run electron:build:win          # Windows x64
```

## 📱 Usage Guide

### Main Features

1. **Timer Control**
   - Set timer duration in the main console
   - Support for countdown and count-up timers
   - Switch to projection mode

2. **Bible Reading**
   - Browse Bible content
   - Projection mode display
   - Support for various display options

3. **Projection Mode**
   - Independent projection window
   - Full-screen display
   - Automatic screen adaptation

### Keyboard Shortcuts

- `Cmd/Ctrl + R` - Reload application
- `F11` - Toggle full-screen mode
- `Esc` - Exit projection mode

## 🛠️ Development Guide

### Project Structure

```
src/
├── components/          # Vue components
│   ├── Bible/          # Bible-related components
│   ├── Timer/          # Timer components
│   └── ...
├── composables/        # Vue composables
├── layouts/           # Layout components
├── locales/           # Internationalization files
├── plugins/           # Vue plugins
├── router/            # Route configuration
├── stores/            # Pinia state management
├── types/             # TypeScript type definitions
└── views/             # Page components
```

### Development Scripts

```bash
# Development mode
npm run dev

# Build project
npm run build

# Type checking
npm run type-check

# Run tests
npm run test:unit

# Code linting
npm run lint

# Code formatting
npm run format

# Preview build results
npm run preview
```

### Code Standards

- Use ESLint for code quality checking
- Use Prettier for code formatting
- Follow Vue 3 Composition API best practices
- TypeScript strict mode

## 🧪 Testing

```bash
# Run unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit -- --watch
```

## 📦 Build & Release

### Build Configuration

Build configuration is located in `electron-builder.config.ts`, supporting:

- macOS (Intel/Apple Silicon/Universal)
- Windows (x64)
- Auto-update configuration
- Application icons and metadata

### Release Process

1. Update version: `npm version patch/minor/major`
2. Build application: `npm run build`
3. Build desktop version: `npm run electron:build:mac-arm`
4. Publish to GitHub Releases

## 🤝 Contributing

We welcome contributions of any kind! Please follow these steps:

1. Fork the project
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Environment Setup

Recommended VS Code extensions:

- [Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
- [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

Thanks to all open-source project contributors, especially:

- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [Electron](https://electronjs.org/) - Cross-platform desktop application framework
- [Vuetify](https://vuetifyjs.com/) - Material Design component library
- [Vite](https://vitejs.dev/) - Fast frontend build tool

---

If you have any questions or suggestions, please submit them in [Issues](https://github.com/rayselfs/hhc-client/issues).
