import { useState } from 'react'
import { isElectron } from '../../../shared/env'

function Versions(): React.JSX.Element {
  const [versions] = useState(
    isElectron()
      ? window.electron.process.versions
      : { electron: 'N/A', chrome: 'N/A', node: 'N/A' }
  )

  return (
    <ul className="absolute bottom-[30px] mx-auto inline-flex items-center overflow-hidden rounded-[22px] bg-[#202127] py-[15px] font-mono backdrop-blur-[24px]">
      <li className="border-r border-[#515c67] px-5 text-sm leading-[14px] opacity-80">
        Electron v{versions.electron}
      </li>
      <li className="border-r border-[#515c67] px-5 text-sm leading-[14px] opacity-80">
        Chromium v{versions.chrome}
      </li>
      <li className="px-5 text-sm leading-[14px] opacity-80">Node v{versions.node}</li>
    </ul>
  )
}

export default Versions
