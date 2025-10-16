import { Menu, BrowserWindow } from 'electron'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

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
      help: '幫助',
      shortcuts: '快捷鍵',
      checkUpdates: '檢查更新',
    },
    en: {
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
      checkUpdates: 'Check for Updates',
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
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('main-message', 'open-shortcuts')
            }
          },
        },
      ],
    },
  ]

  // macOS 特殊處理
  template.unshift({
    label: 'HHC',
    submenu: [
      {
        label: t.about,
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('main-message', 'open-about')
          }
        },
      },
      {
        label: t.checkUpdates,
        click: () => {
          autoUpdater.checkForUpdates()
        },
      },
      { type: 'separator' },
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
        accelerator: 'Command+Q',
        click: () => {
          app.quit()
        },
      },
    ],
  })

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
