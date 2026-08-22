import { access } from 'node:fs/promises'
import { join } from 'node:path'

const bindingPath = join(
  process.cwd(),
  'node_modules',
  'electron-vlc-player',
  'build',
  'Release',
  'vlc_binding.node'
)

try {
  await access(bindingPath)
  console.log('ready: electron-vlc-player native binding')
} catch {
  console.error(`Missing electron-vlc-player native binding: ${bindingPath}`)
  console.error('Install the platform C++ toolchain, then run:')
  console.error('  npx electron-rebuild -f -w electron-vlc-player')
  console.error(
    'Windows requires Visual Studio Build Tools with Desktop development with C++ and a Windows SDK.'
  )
  process.exitCode = 1
}
