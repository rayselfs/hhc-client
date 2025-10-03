import { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.hhc.client',
  productName: 'HHC Client',

  files: ['dist-electron/**/*', '!**/*.map'],

  directories: {
    output: 'release',
    buildResources: 'build',
  },

  publish: {
    provider: 'github',
    owner: 'rayselfs',
    repo: 'hhc-client',
  },

  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.utilities',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // 如果沒有 Apple Developer ID，則跳過簽名
    identity: process.env.CSC_NAME || null,
    notarize: !!process.env.APPLE_ID,
  },
  win: { target: 'nsis' },
  linux: { target: 'AppImage' },
}

export default config
