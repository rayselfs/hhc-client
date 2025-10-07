import { Menu, BrowserWindow } from 'electron'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { app } from 'electron'

// 語系設定讀取
const getLanguage = () => {
  try {
    const userDataPath = app.getPath('userData')
    const settingsPath = path.join(userDataPath, 'language-settings.json')
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'))
      return settings.language || 'zh'
    }
  } catch (error) {
    console.error('讀取語系設定失敗:', error)
  }
  return 'zh'
}

// 翻譯函數
const getTranslations = (lang: string) => {
  const translations: Record<string, Record<string, string>> = {
    zh: {
      file: '檔案',
      preferences: '偏好設定',
      quit: '結束',
      about: '關於',
      services: '服務',
      hide: '隱藏',
      hideOthers: '隱藏其他',
      unhide: '顯示全部',
      edit: '編輯',
      undo: '復原',
      redo: '重做',
      cut: '剪下',
      copy: '複製',
      paste: '貼上',
      help: '說明',
      shortcuts: '快捷鍵',
    },
    en: {
      file: 'File',
      preferences: 'Preferences',
      quit: 'Quit',
      about: 'About',
      services: 'Services',
      hide: 'Hide',
      hideOthers: 'Hide Others',
      unhide: 'Show All',
      edit: 'Edit',
      undo: 'Undo',
      redo: 'Redo',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      help: 'Help',
      shortcuts: 'Keyboard Shortcuts',
    },
  }
  return translations[lang] || translations.zh
}

// 創建應用程式選單
export const createApplicationMenu = (mainWindow: BrowserWindow | null) => {
  const lang = getLanguage()
  const t = getTranslations(lang)

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t.file,
      submenu: [
        {
          label: t.preferences,
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('main-message', 'open-settings')
            }
          },
        },
        { type: 'separator' },
        {
          label: t.quit,
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          },
        },
      ],
    },
    {
      label: t.edit,
      submenu: [
        {
          label: t.undo,
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.undo()
            }
          },
        },
        {
          label: t.redo,
          accelerator: 'CmdOrCtrl+Y',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.redo()
            }
          },
        },
        { type: 'separator' },
        {
          label: t.cut,
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.cut()
            }
          },
        },
        {
          label: t.copy,
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.copy()
            }
          },
        },
        {
          label: t.paste,
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.paste()
            }
          },
        },
      ],
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.shortcuts,
          accelerator: 'CmdOrCtrl+?',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('main-message', 'open-shortcuts')
            }
          },
        },
        {
          label: t.about,
          accelerator: process.platform === 'darwin' ? '' : 'F1',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('main-message', 'open-about')
            }
          },
        },
      ],
    },
  ]

  // macOS 特殊處理
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: t.about,
          role: 'about',
        },
        { type: 'separator' },
        {
          label: t.services,
          role: 'services',
        },
        { type: 'separator' },
        {
          label: t.hide,
          accelerator: 'Command+H',
          role: 'hide',
        },
        {
          label: t.hideOthers,
          accelerator: 'Command+Shift+H',
          role: 'hideOthers',
        },
        {
          label: t.unhide,
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: t.quit,
          accelerator: 'Command+Q',
          click: () => {
            app.quit()
          },
        },
      ],
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
