# HHC Client - Church Projection Control System

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/Electron-38.1.2-47848F.svg)
![Vue](https://img.shields.io/badge/Vue-3.5.21-4FC08D.svg)

A multi-functional projection control system designed for church activities, supporting Bible projection, timers, and world clock display.

</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [System Requirements](#-system-requirements)
- [Quick Start](#-quick-start)
- [Development Guide](#-development-guide)
- [Auto-Update Setup](#-auto-update-setup)
- [Release Process](#-release-process)
- [User Guide](#-user-guide)
- [Technical Architecture](#-technical-architecture)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Functions

- 📖 **Bible Projection**
  - Full Bible chapter display support
  - Clear and readable projection interface
  - Quick chapter navigation
- ⏱️ **Countdown Timer**
  - Customizable countdown duration
  - Visual circular progress bar (SVG implementation)
  - Pause and reset functionality
  - Alert when time is up

- 🕐 **World Clock**
  - Multi-timezone support
  - Real-time updates
  - Clean and elegant interface

### System Features

- 🖥️ **Dual Display Support**
  - Automatic second screen detection
  - Separate control and projection windows
  - Full-screen projection mode

- 🔄 **Auto-Update**
  - Automatic update check on startup
  - Silent background downloads
  - Update prompt on application close
  - One-click update and restart

- 🌐 **Multi-Language Support**
  - Traditional Chinese
  - English
  - Easy to extend to other languages

- 🎨 **Modern Interface**
  - Vuetify 3 Material Design
  - Responsive design
  - Dark theme support

---

## 💻 System Requirements

### Minimum Requirements

- **OS**: Windows 10 or macOS 10.15+
- **RAM**: 4GB
- **Storage**: 200MB available space
- **Display**: 1280x720 or higher

### Development Environment

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher
- **Git**: For version control

---

## 🚀 Quick Start

### User Installation

1. Go to [Releases page](https://github.com/rayselfs/hhc-client/releases)
2. Download the latest installer
   - **Windows**: Download `.exe` file
   - **macOS**: Download `.zip` file and extract
3. Run the installer
4. Launch the application

### Developer Installation

```bash
# Clone the repository
git clone https://github.com/rayselfs/hhc-client.git
cd hhc-client

# Install dependencies
npm install

# Start development mode
npm run dev
```

---

## 🛠️ Development Guide

### Project Structure

```
hhc-client/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
├── src/
│   ├── assets/            # Static resources (images, styles)
│   ├── components/        # Vue components
│   ├── composables/       # Vue Composition API
│   ├── layouts/           # Layout components
│   ├── locales/          # Internationalization files
│   ├── plugins/          # Vue plugins (i18n, Vuetify)
│   ├── router/           # Vue Router configuration
│   ├── stores/           # Pinia state management
│   ├── types/            # TypeScript type definitions
│   ├── views/            # Page components
│   ├── main.ts           # Electron main process
│   ├── preload.ts        # Preload script
│   └── renderer.ts       # Vue renderer process entry
├── forge.config.ts        # Electron Forge configuration
├── package.json
└── tsconfig.json
```

### Available Commands

```bash
# Development mode (with hot reload)
npm run dev

# Format code
npm run format

# Lint code
npm run lint

# Package application (without installer)
npm run package

# Create installers (Windows .exe / macOS .zip)
npm run make

# Publish to GitHub (requires GITHUB_TOKEN)
npm run publish
```

### Development Best Practices

1. **Use TypeScript**: Leverage type checking to reduce runtime errors
2. **Component-Based Development**: Keep components single-purpose for easier maintenance
3. **State Management**: Use Pinia for shared state
4. **Git Conventions**: Follow conventional commits format

---

## 🔄 Auto-Update Setup

### How It Works

The application has built-in auto-update mechanism:

1. **Startup Check**: Automatically checks for updates 3 seconds after launch
2. **Background Download**: Downloads new version silently in the background
3. **Close Prompt**: Shows dialog when user closes app if update is downloaded
4. **User Choice**:
   - **Update Now**: Install update and restart application
   - **Remind Later**: Close normally, check again on next launch

### Update Dialog

```
┌─────────────────────────────┐
│   Update Available          │
│                             │
│ A new version is ready      │
│ Install now?                │
│ App will restart.           │
│                             │
│  [Update Now]  [Later]      │
└─────────────────────────────┘
```

### Initial Configuration

⚠️ **Important**: Before first use, replace `rayselfs` in these 3 files:

#### 1. `forge.config.ts`

```typescript
publishers: [
  new PublisherGithub({
    repository: {
      owner: 'rayselfs',  // ← Change this
      name: 'hhc-client',
    },
    prerelease: false,
    draft: true,
  }),
],
```

#### 2. `package.json`

```json
"repository": {
  "type": "git",
  "url": "https://github.com/rayselfs/hhc-client.git"  // ← Change this
},
```

#### 3. `src/main.ts`

```typescript
const server = 'https://github.com/rayselfs/hhc-client' // ← Change this
```

### Update URL

autoUpdater checks for updates at:

```
https://github.com/rayselfs/hhc-client/releases/latest/download
```

> **Note**: Release must be **Published** (not Draft) for update checks to work.

### Development Mode

In development mode (`npm run dev`), auto-update is disabled. Console shows:

```
Development mode: Auto-update disabled
```

---

## 📦 Release Process

### Method 1: Using Git Tags (Recommended)

The simplest and most automated way:

```bash
# 1. Update version number
npm version patch    # 1.0.0 → 1.0.1 (bug fixes)
npm version minor    # 1.0.0 → 1.1.0 (new features)
npm version major    # 1.0.0 → 2.0.0 (breaking changes)

# 2. Push to GitHub (triggers build automatically)
git push origin main
git push origin --tags
```

After pushing tags, GitHub Actions will automatically:

- ✅ Build Windows version (.exe)
- ✅ Build macOS version (.zip)
- ✅ Create draft Release
- ✅ Upload installers to Release

### Method 2: Manual Trigger

1. Go to GitHub Repository
2. Click **Actions** tab
3. Select **Build and Release** workflow
4. Click **Run workflow** button
5. Choose branch and run

### Finalizing Release

After build completes, manually finalize the release:

1. **Check Build Status**
   - Confirm successful build in GitHub Actions
   - Ensure both Windows and macOS builds completed

2. **Edit Release**
   - Go to GitHub Releases page
   - Find the newly created draft Release
   - Edit release notes (auto-generated)
   - Confirm attachments include:
     - Windows installer (.exe and .nupkg)
     - macOS installer (.zip)

3. **Publish Release**
   - After verification, click **Publish release**
   - Users can now download and receive auto-updates

### Release Checklist

- [ ] Update version in `package.json`
- [ ] Verify GitHub username in all config files
- [ ] Commit and push code to GitHub
- [ ] Create and push version tag
- [ ] Wait for GitHub Actions build (~10-20 minutes)
- [ ] Check build artifacts (Windows and macOS)
- [ ] Edit release notes
- [ ] Publish Release (from Draft to Published)
- [ ] Test auto-update functionality

---

## 📚 User Guide

### Control Panel Operations

1. **Launch Application**
   - Opens control panel window on first launch
   - Automatically opens projection window if second screen detected

2. **Bible Projection**
   - Select Bible book
   - Select chapter
   - Click projection button

3. **Timer**
   - Set countdown duration
   - Click start button
   - Support pause and reset
   - Choose display mode (timer only / clock only / both)

4. **Clock**
   - Select timezone
   - Displays current time in real-time

### Keyboard Shortcuts (Planned)

- `Ctrl/Cmd + N`: New projection
- `Ctrl/Cmd + P`: Open/close projection window
- `Space`: Play/pause timer
- `Esc`: Close projection window

---

## 🏗️ Technical Architecture

### Technology Stack

#### Frontend Framework

- **Vue 3**: Progressive JavaScript framework
- **TypeScript**: Type-safe JavaScript superset
- **Vuetify 3**: Material Design component library
- **Vue Router**: Official routing library
- **Pinia**: Lightweight state management
- **Vue I18n**: Internationalization plugin

#### Desktop Application

- **Electron 38**: Cross-platform desktop framework
- **Electron Forge**: Packaging and distribution tool
- **Vite**: Fast build tool

#### Development Tools

- **ESLint**: Code linting tool
- **Prettier**: Code formatter
- **TypeScript Compiler**: TypeScript compiler

#### CI/CD

- **GitHub Actions**: Automated build and deployment
- **GitHub Releases**: Version release management

### Architecture Design

```
┌─────────────────────────────────────────┐
│           Electron Main Process         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ Main Window  │    │  Projection  │  │
│  │  (Control)   │    │    Window    │  │
│  └──────────────┘    └──────────────┘  │
│         │                    │          │
│         └────────IPC─────────┘          │
│              ↓                           │
│       ┌──────────────┐                  │
│       │ Auto Updater │                  │
│       └──────────────┘                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│        Vue 3 Renderer Process           │
│  ┌──────────┐  ┌──────────┐            │
│  │  Router  │  │  Pinia   │            │
│  └──────────┘  └──────────┘            │
│         │            │                  │
│    ┌────┴────────────┴─────┐           │
│    │    Components          │           │
│    │  - Bible               │           │
│    │  - Timer               │           │
│    │  - Clock               │           │
│    └────────────────────────┘           │
└─────────────────────────────────────────┘
```

### IPC Communication

Main process and renderer process communicate via IPC (Inter-Process Communication):

```typescript
// Main process → Projection window
ipcMain.on('send-to-projection', (event, data) => {
  projectionWindow.webContents.send('projection-message', data)
})

// Projection window → Main process
ipcMain.on('send-to-main', (event, data) => {
  mainWindow.webContents.send('main-message', data)
})
```

---

## 🐛 Troubleshooting

### Build Failures

**Problem**: `npm run make` fails

**Solutions**:

1. Check if Node.js version is 20.x
   ```bash
   node --version
   ```
2. Clear cache and reinstall dependencies
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
3. Check GitHub Actions logs for detailed error messages

### Auto-Update Not Working

**Problem**: Application doesn't auto-update

**Possible causes and solutions**:

1. **Release Status Issue**
   - Verify Release is Published (not Draft)
   - Check GitHub Releases page

2. **Network Connection**
   - Check internet connection
   - Verify GitHub is accessible

3. **Repository Permissions**
   - Ensure GitHub repository is public
   - Or verify correct access permissions

4. **Development Mode**
   - Confirm using packaged version, not dev mode

### Projection Window Won't Open

**Problem**: Cannot open projection window or content not displaying

**Solutions**:

1. Check if second screen is connected
2. Manually open projection window from control panel
3. Check console for error messages
4. Restart application

### Timer Progress Bar Not Showing

**Problem**: Circular progress bar not displaying

**Solutions**:

1. Check browser console for errors
2. Verify SVG-related CSS is loaded correctly
3. Try resizing window to trigger re-render

### No Update Prompt After Download

**Problem**: Update downloaded but no prompt on close

**Solutions**:

1. Ensure application closed normally (not force quit)
2. Check `checkUpdateBeforeQuit` function in `main.ts`
3. Review console logs for update status

---

## 🤝 Contributing

Contributions are welcome! Here's how to contribute:

### Submitting Issues

- Clearly describe the problem or suggestion
- Provide reproduction steps (if bug)
- Include screenshots (if applicable)
- Specify your environment (OS, version, etc.)

### Submitting Pull Requests

1. **Fork the project**

   ```bash
   git clone https://github.com/YOUR_USERNAME/hhc-client.git
   ```

2. **Create a branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Commit changes**

   ```bash
   git commit -m 'feat: add amazing feature'
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `style`: Code formatting
   - `refactor`: Code refactoring
   - `test`: Tests
   - `chore`: Other changes

4. **Push to GitHub**

   ```bash
   git push origin feature/amazing-feature
   ```

5. **Open Pull Request**

### Code Standards

- Follow ESLint rules
- Use Prettier for code formatting
- Write appropriate comments for new features
- Keep code clean and readable

---

## 📚 References

### Official Documentation

- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron Forge](https://www.electronforge.io/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vuetify 3 Documentation](https://vuetifyjs.com/)
- [Pinia Documentation](https://pinia.vuejs.org/)
- [GitHub Actions](https://docs.github.com/en/actions)

### Related Resources

- [Electron autoUpdater API](https://www.electronjs.org/docs/latest/api/auto-updater)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

---

## 🎯 Roadmap

### Short-term Goals

- [ ] Code signing (Windows and macOS)
- [ ] Add more keyboard shortcuts
- [ ] Improve error handling and logging
- [ ] Add usage analytics (optional)

### Mid-term Goals

- [ ] Support more Bible versions
- [ ] Lyrics projection feature
- [ ] Presentation projection feature
- [ ] Custom themes

### Long-term Goals

- [ ] Cross-platform settings sync
- [ ] Cloud backup
- [ ] Mobile device remote control
- [ ] Plugin system

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

### You are free to:

- ✅ Use this software freely (including commercial use)
- ✅ Modify the source code
- ✅ Distribute original or modified versions
- ✅ Use for private or public projects

### Only condition:

- 📋 Retain original copyright and license notices in all copies

See [LICENSE](LICENSE) file for full license text.

---

## 👤 Author

**Ray**

- Email: rayselfs@alive.org.tw
- GitHub: [@rayselfs](https://github.com/rayselfs)

---

## 🙏 Acknowledgments

Thanks to the following open source projects:

- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [Vuetify](https://vuetifyjs.com/) - Material Design component library
- [Vite](https://vitejs.dev/) - Next generation build tool

Special thanks to all contributors and users for their support!

---

<div align="center">

**If this project helps you, please give it a ⭐️ Star!**

Made with ❤️ by Ray

</div>
