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

  mac: { target: 'dmg' },
  win: { target: 'nsis' },
  linux: { target: 'AppImage' },
}

export default config
