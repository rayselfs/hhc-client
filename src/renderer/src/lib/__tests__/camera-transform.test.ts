import { createCameraCover, resizeCamera } from '../camera-transform'

it('covers landscape, portrait and wide sources without distortion', () => {
  expect(createCameraCover(640, 480)).toEqual({ x: 0, y: -180, width: 1920, height: 1440 })
  expect(createCameraCover(1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
  expect(createCameraCover(1080, 1920).height).toBeCloseTo(3413.333333333333)
  expect(createCameraCover(3840, 1080)).toEqual({ x: -960, y: 0, width: 3840, height: 1080 })
  expect(() => createCameraCover(0, 480)).toThrow()
  expect(() => createCameraCover(Infinity, 480)).toThrow()
})
it('keeps the opposite corner and aspect ratio when resizing', () => {
  expect(resizeCamera({ x: 0, y: 0, width: 1920, height: 1080 }, 'nw', 960, 1920)).toEqual({
    x: 960,
    y: 540,
    width: 960,
    height: 540
  })
})

it('locks aspect ratio around the opposite midpoint for edge handles', () => {
  const frame = { x: 0, y: 0, width: 1920, height: 1080 }
  expect(resizeCamera(frame, 'e', 960, 1920)).toEqual({ x: 0, y: 270, width: 960, height: 540 })
  expect(resizeCamera(frame, 'w', 960, 1920)).toEqual({ x: 960, y: 270, width: 960, height: 540 })
  expect(resizeCamera(frame, 'n', 960, 1920)).toEqual({ x: 480, y: 540, width: 960, height: 540 })
  expect(resizeCamera(frame, 's', 960, 1920)).toEqual({ x: 480, y: 0, width: 960, height: 540 })
})
