import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'

function App(): React.JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1b1b1f]">
      <img
        alt="logo"
        className="mb-5 size-32 transition-[filter] duration-300 hover:drop-shadow-[0_0_1.2em_#6988e6aa]"
        src={electronLogo}
        draggable={false}
      />
      <div className="mb-2.5 text-sm font-semibold text-white/60">Powered by electron-vite</div>
      <div className="mx-2.5 py-4 text-center text-[28px] font-bold leading-8 text-white/85">
        Build an Electron app with{' '}
        <span className="bg-gradient-to-br from-[#087ea4] from-55% to-[#7c93ee] bg-clip-text font-bold text-transparent">
          React
        </span>
        &nbsp;and{' '}
        <span className="bg-gradient-to-br from-[#3178c6] from-45% to-[#f0dc4e] bg-clip-text font-bold text-transparent">
          TypeScript
        </span>
      </div>
      <p className="text-base font-semibold leading-6 text-white/60">
        Please try pressing{' '}
        <code className="rounded-sm bg-[#282828] px-1.5 py-0.5 font-mono text-[85%] font-semibold">
          F12
        </code>{' '}
        to open the devTool
      </p>
      <div className="-m-1.5 flex flex-wrap pt-8">
        <div className="shrink-0 p-1.5">
          <a
            className="inline-block cursor-pointer rounded-[20px] border border-transparent bg-[#32363f] px-5 text-sm font-semibold leading-[38px] text-white/85 no-underline hover:bg-[#414853]"
            href="https://electron-vite.org/"
            target="_blank"
            rel="noreferrer"
          >
            Documentation
          </a>
        </div>
        <div className="shrink-0 p-1.5">
          <a
            className="inline-block cursor-pointer rounded-[20px] border border-transparent bg-[#32363f] px-5 text-sm font-semibold leading-[38px] text-white/85 no-underline hover:bg-[#414853]"
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
