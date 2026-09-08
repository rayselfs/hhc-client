import { useCameraStore } from '../camera'
import { createCameraCover } from '@renderer/lib/camera-transform'

it('restores layout by device and keeps center and zoom across aspect changes', () => {
  const store = useCameraStore
  store.setState({ layouts: {}, deviceId: '', capturing: false })
  const cover = createCameraCover(1920, 1080)
  store.getState().activateSource('one', cover)
  store.getState().updateTransform({ x: 100, y: 200, width: 960, height: 540 })
  store.getState().activateSource('two', cover)
  expect(store.getState().transform).toEqual(cover)
  store.getState().activateSource('one', cover)
  expect(store.getState().transform).toEqual({ x: 100, y: 200, width: 960, height: 540 })
  store.getState().activateSource('one', createCameraCover(640, 480))
  expect(store.getState().transform).toEqual({ x: 100, y: 110, width: 960, height: 720 })
  const persisted = store.persist.getOptions().partialize!(store.getState())
  expect(persisted).toHaveProperty('layouts.one')
  expect(persisted).not.toHaveProperty('capturing')
  store.getState().updateTransform(store.getState().cover)
  store.getState().activateSource('two', cover)
  store.getState().activateSource('one', cover)
  expect(store.getState().transform).toEqual(cover)
})
