import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'
import { useTheme } from '@renderer/contexts/ThemeContext'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  const { preference, setPreference } = useTheme()

  const NEXT_THEME = { light: 'dark', dark: 'system', system: 'light' } as const

  const THEME_LABEL: Record<string, string> = {
    light: '☀️ Light',
    dark: '🌙 Dark',
    system: '💻 System'
  }

  const handleToggle = (): void => {
    setPreference(NEXT_THEME[preference])
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-[#1b1b1f]">
      <img
        alt="logo"
        className="mb-5 size-32 transition-[filter] duration-300 hover:drop-shadow-[0_0_1.2em_#6988e6aa]"
        src={electronLogo}
        draggable={false}
      />
      <div className="mb-2.5 text-sm font-semibold text-gray-500 dark:text-white/60">
        Powered by electron-vite
      </div>
      <div className="mx-2.5 py-4 text-center text-[28px] font-bold leading-8 text-gray-800 dark:text-white/85">
        Build an Electron app with{' '}
        <span className="bg-gradient-to-br from-[#087ea4] from-55% to-[#7c93ee] bg-clip-text font-bold text-transparent">
          React
        </span>
        &nbsp;and{' '}
        <span className="bg-gradient-to-br from-[#3178c6] from-45% to-[#f0dc4e] bg-clip-text font-bold text-transparent">
          TypeScript
        </span>
      </div>
      <p className="text-base font-semibold leading-6 text-gray-500 dark:text-white/60">
        Please try pressing{' '}
        <code className="rounded-sm bg-gray-200 dark:bg-[#282828] px-1.5 py-0.5 font-mono text-[85%] font-semibold">
          F12
        </code>{' '}
        to open the devTool
      </p>
      <div className="-m-1.5 flex flex-wrap pt-8">
        <div className="shrink-0 p-1.5">
          <button
            onClick={handleToggle}
            className="rounded-[18px] border border-transparent bg-gray-200 dark:bg-[#32363f] px-5 py-2 text-sm font-medium text-gray-800 dark:text-white/85 transition-colors duration-0 hover:bg-gray-300 dark:hover:bg-[#414853] focus:outline-none"
          >
            {THEME_LABEL[preference]}
          </button>
        </div>
        <div className="shrink-0 p-1.5">
          <a
            className="inline-block cursor-pointer rounded-[20px] border border-transparent bg-gray-200 dark:bg-[#32363f] px-5 text-sm font-semibold leading-[38px] text-gray-800 dark:text-white/85 no-underline hover:bg-gray-300 dark:hover:bg-[#414853]"
            target="_blank"
            rel="noreferrer"
            onClick={ipcHandle}
          >
            Send IPC
          </a>
        </div>
      </div>
      <Versions />
    </div>
  )
}

export default App
