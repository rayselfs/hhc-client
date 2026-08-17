/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

function spawn(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  }
}

async function requirePath(path, label) {
  if (!path) throw new Error(`${label} path is required`)
  try {
    await stat(path)
  } catch {
    throw new Error(`${label} not found: ${basename(path)}`)
  }
}

function requireSuccess(result, message) {
  if (result.status !== 0) throw new Error(message)
  return result.stdout.trim()
}

function powershellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`
}

async function verifyMac(appPath, run) {
  await requirePath(appPath, 'Signed app')
  const name = basename(appPath)

  requireSuccess(
    run('codesign', ['--verify', '--deep', '--strict', appPath]),
    `macOS code signature verification failed for ${name}`
  )
  requireSuccess(
    run('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath]),
    `macOS Gatekeeper assessment failed for ${name}`
  )
  requireSuccess(
    run('xcrun', ['stapler', 'validate', appPath]),
    `macOS notarization ticket validation failed for ${name}`
  )

  const infoPath = join(appPath, 'Contents', 'Info.plist')
  const protocolJson = requireSuccess(
    run('plutil', ['-extract', 'CFBundleURLTypes', 'json', '-o', '-', infoPath]),
    `macOS protocol metadata validation failed for ${name}`
  )
  let protocolTypes
  try {
    protocolTypes = JSON.parse(protocolJson)
  } catch {
    throw new Error(`macOS protocol metadata validation failed for ${name}`)
  }
  if (
    !Array.isArray(protocolTypes) ||
    !protocolTypes.some(
      (entry) =>
        entry &&
        Array.isArray(entry.CFBundleURLSchemes) &&
        entry.CFBundleURLSchemes.includes('librepresenter')
    )
  ) {
    throw new Error(`librepresenter protocol is missing from ${name}`)
  }
}

async function verifyAuthenticode(path, run) {
  await requirePath(path, 'Signed Windows artifact')
  const script = `(Get-AuthenticodeSignature -LiteralPath ${powershellLiteral(path)}).Status`
  const status = requireSuccess(
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]),
    `Windows Authenticode verification failed for ${basename(path)}`
  )
  if (status !== 'Valid') {
    throw new Error(`Windows Authenticode verification failed for ${basename(path)}`)
  }
}

async function verifyWindows(appPath, installerPath, run) {
  await verifyAuthenticode(appPath, run)
  await verifyAuthenticode(installerPath, run)

  const command = requireSuccess(
    run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "(Get-Item -LiteralPath 'Registry::HKEY_CURRENT_USER\\Software\\Classes\\librepresenter\\shell\\open\\command').GetValue('')"
    ]),
    'Windows librepresenter protocol registration validation failed'
  )
  const trimmedCommand = command.trim()
  const closingQuote = trimmedCommand.startsWith('"') ? trimmedCommand.indexOf('"', 1) : -1
  const registeredExecutable =
    closingQuote > 0 ? trimmedCommand.slice(1, closingQuote) : trimmedCommand.split(/\s/, 1)[0]
  if (resolve(registeredExecutable).toLowerCase() !== resolve(appPath).toLowerCase()) {
    throw new Error('Windows librepresenter protocol registration is invalid')
  }
}

export async function verifySignedPackage({ platform, appPath, installerPath, run = spawn }) {
  if (platform === 'darwin') {
    await verifyMac(appPath, run)
    return
  }
  if (platform === 'win32') {
    await verifyWindows(appPath, installerPath, run)
    return
  }
  throw new Error(`Unsupported signing platform: ${platform}`)
}

async function main() {
  await verifySignedPackage({
    platform: process.platform,
    appPath: process.env.SIGNED_APP_PATH,
    installerPath: process.env.SIGNED_INSTALLER_PATH
  })
  console.log(`signed package verified (${process.platform})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Signed package verification failed')
    process.exitCode = 1
  })
}
