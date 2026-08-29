import { beforeEach, describe, expect, it } from 'vitest'
import { useUpdateStore } from '../update'

describe('useUpdateStore', () => {
  beforeEach(() => {
    useUpdateStore.getState().reset()
  })

  it('tracks download percentage and clears it after download finishes', () => {
    useUpdateStore.getState().setDownloading(42)
    expect(useUpdateStore.getState()).toMatchObject({
      status: 'downloading',
      downloadPercent: 42
    })

    useUpdateStore.getState().setDownloaded()
    expect(useUpdateStore.getState()).toMatchObject({
      status: 'downloaded',
      downloadPercent: null
    })
  })

  it('tracks macOS verification and opened installer states', () => {
    useUpdateStore.getState().setAvailable('2.4.1')
    useUpdateStore.getState().setVerifying()
    expect(useUpdateStore.getState()).toMatchObject({
      status: 'verifying',
      availableVersion: '2.4.1',
      downloadPercent: null
    })

    useUpdateStore.getState().setInstallerOpened()
    expect(useUpdateStore.getState()).toMatchObject({
      status: 'installer-opened',
      availableVersion: '2.4.1'
    })
  })
})
