/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('release builder config requires hardened signed and notarized macOS packages', async () => {
  const config = await readFile(join(root, 'electron-builder.yml'), 'utf8')

  assert.doesNotMatch(config, /^\s*identity:\s*null\s*$/m)
  assert.doesNotMatch(config, /^\s*hardenedRuntime:\s*false\s*$/m)
  assert.doesNotMatch(config, /^\s*notarize:\s*false\s*$/m)
  assert.match(config, /^\s*hardenedRuntime:\s*true\s*$/m)
  assert.match(config, /^\s*notarize:\s*true\s*$/m)
})

test('macOS signing keeps only Electron and native media runtime entitlements', async () => {
  const entitlements = await readFile(join(root, 'build/entitlements.mac.plist'), 'utf8')
  const keys = [...entitlements.matchAll(/<key>([^<]+)<\/key>/g)].map((match) => match[1])

  assert.deepEqual(keys, [
    'com.apple.security.cs.allow-jit',
    'com.apple.security.cs.allow-unsigned-executable-memory',
    'com.apple.security.cs.disable-library-validation'
  ])
})

test('tag packages require named macOS Apple and Windows signing secrets', async () => {
  const workflow = await readFile(join(root, '.github/workflows/build-release.yml'), 'utf8')

  for (const secret of [
    'MAC_CSC_LINK',
    'MAC_CSC_KEY_PASSWORD',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER',
    'WIN_CSC_LINK',
    'WIN_CSC_KEY_PASSWORD'
  ]) {
    assert.match(workflow, new RegExp(`secrets\\.${secret}\\b`))
  }
  assert.match(workflow, /if:\s*startsWith\(github\.ref, 'refs\/tags\/v'\)/)
  assert.match(workflow, /npm run check:signed-package/)
  assert.doesNotMatch(workflow, /run:\s*[^\n]*\$\{\{\s*secrets\./)
  assert.match(workflow, /APPLE_API_KEY_SECRET:\s*\$\{\{ secrets\.APPLE_API_KEY \}\}/)
  assert.match(workflow, /APPLE_API_KEY_PATH="\$\{RUNNER_TEMP\}\/[^"]+\.p8"/)
  assert.match(workflow, /printf '%s' "\$\{APPLE_API_KEY_SECRET\}" > "\$\{APPLE_API_KEY_PATH\}"/)
  assert.doesNotMatch(workflow, /echo "APPLE_API_(?:KEY_ID|ISSUER)=\$\{APPLE_API_/)
})

test('manual packages use an explicit unsigned step isolated from tags', async () => {
  const workflow = await readFile(join(root, '.github/workflows/build-release.yml'), 'utf8')

  assert.match(workflow, /if:\s*github\.event_name == 'workflow_dispatch'/)
  assert.match(workflow, /CSC_IDENTITY_AUTO_DISCOVERY:\s*false/)
  assert.match(workflow, /--config\.mac\.identity=null/)
  assert.match(workflow, /--config\.mac\.notarize=false/)

  const signedStep = workflow.match(
    /- name: Build signed desktop package[\s\S]*?(?=\n\s{6}- name:)/
  )?.[0]
  assert.ok(signedStep)
  assert.doesNotMatch(signedStep, /identity=null|notarize=false|CSC_IDENTITY_AUTO_DISCOVERY/)
})

test('verifies macOS signature Gatekeeper notarization and protocol metadata', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'signed-package-mac-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const appPath = join(fixture, 'LibrePresenter.app')
  await mkdir(join(appPath, 'Contents'), { recursive: true })
  await writeFile(join(appPath, 'Contents', 'Info.plist'), '<plist/>')
  const calls = []
  const run = (command, args) => {
    calls.push([command, ...args])
    return {
      status: 0,
      stdout:
        command === 'plutil' ? JSON.stringify([{ CFBundleURLSchemes: ['librepresenter'] }]) : ''
    }
  }
  const { verifySignedPackage } = await import('../check-signed-package.mjs')

  await verifySignedPackage({ platform: 'darwin', appPath, run })

  assert.deepEqual(
    calls.map(([command]) => command),
    ['codesign', 'spctl', 'xcrun', 'plutil']
  )
  assert.deepEqual(calls[0], ['codesign', '--verify', '--deep', '--strict', appPath])
  assert.deepEqual(calls[1], ['spctl', '--assess', '--type', 'execute', '--verbose=2', appPath])
  assert.deepEqual(calls[2], ['xcrun', 'stapler', 'validate', appPath])
})

test('rejects a macOS package when signature verification fails without exposing output', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'signed-package-bad-mac-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const appPath = join(fixture, 'LibrePresenter.app')
  await mkdir(appPath)
  const run = () => ({ status: 1, stdout: 'certificate secret', stderr: 'private detail' })
  const { verifySignedPackage } = await import('../check-signed-package.mjs')

  await assert.rejects(
    verifySignedPackage({ platform: 'darwin', appPath, run }),
    (error) =>
      error instanceof Error &&
      error.message === 'macOS code signature verification failed for LibrePresenter.app'
  )
})

test('verifies Windows app and installer Authenticode plus protocol registration', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'signed-package-win-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const appPath = join(fixture, 'libre-presenter.exe')
  const installerPath = join(fixture, 'libre-presenter-setup.exe')
  await writeFile(appPath, '')
  await writeFile(installerPath, '')
  const calls = []
  const run = (command, args) => {
    calls.push([command, ...args])
    const script = args.at(-1)
    return {
      status: 0,
      stdout: script.includes('Get-AuthenticodeSignature') ? 'Valid\r\n' : `"${appPath}" "%1"\r\n`
    }
  }
  const { verifySignedPackage } = await import('../check-signed-package.mjs')

  await verifySignedPackage({ platform: 'win32', appPath, installerPath, run })

  assert.equal(calls.length, 3)
  assert.ok(calls.every(([command]) => command === 'powershell.exe'))
  assert.match(calls[0].at(-1), /Get-AuthenticodeSignature/)
  assert.match(calls[1].at(-1), /Get-AuthenticodeSignature/)
  assert.match(calls[2].at(-1), /librepresenter/)
})

test('rejects a Windows package unless every Authenticode status is Valid', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'signed-package-bad-win-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const appPath = join(fixture, 'libre-presenter.exe')
  const installerPath = join(fixture, 'libre-presenter-setup.exe')
  await writeFile(appPath, '')
  await writeFile(installerPath, '')
  let call = 0
  const run = () => ({ status: 0, stdout: ++call === 1 ? 'Valid\n' : 'NotSigned\n' })
  const { verifySignedPackage } = await import('../check-signed-package.mjs')

  await assert.rejects(
    verifySignedPackage({ platform: 'win32', appPath, installerPath, run }),
    (error) =>
      error instanceof Error &&
      error.message === 'Windows Authenticode verification failed for libre-presenter-setup.exe'
  )
})

test('rejects a stale Windows protocol registration with the same executable name', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'signed-package-stale-win-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const appPath = join(fixture, 'libre-presenter.exe')
  const installerPath = join(fixture, 'libre-presenter-setup.exe')
  await writeFile(appPath, '')
  await writeFile(installerPath, '')
  let call = 0
  const run = () => ({
    status: 0,
    stdout: ++call <= 2 ? 'Valid\n' : '"C:\\OldInstall\\libre-presenter.exe" "%1"\n'
  })
  const { verifySignedPackage } = await import('../check-signed-package.mjs')

  await assert.rejects(
    verifySignedPackage({ platform: 'win32', appPath, installerPath, run }),
    (error) =>
      error instanceof Error &&
      error.message === 'Windows librepresenter protocol registration is invalid'
  )
})

test('rejects a Windows protocol command whose executable only prefixes the current path', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'signed-package-prefix-win-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  const appPath = join(fixture, 'libre-presenter.exe')
  const installerPath = join(fixture, 'libre-presenter-setup.exe')
  await writeFile(appPath, '')
  await writeFile(installerPath, '')
  let call = 0
  const run = () => ({
    status: 0,
    stdout: ++call <= 2 ? 'Valid\n' : `"${appPath}.old" "%1"\n`
  })
  const { verifySignedPackage } = await import('../check-signed-package.mjs')

  await assert.rejects(
    verifySignedPackage({ platform: 'win32', appPath, installerPath, run }),
    (error) =>
      error instanceof Error &&
      error.message === 'Windows librepresenter protocol registration is invalid'
  )
})
