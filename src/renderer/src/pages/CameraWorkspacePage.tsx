import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CameraStage from '@renderer/components/Common/CameraStage'
import { useCameraSession } from '@renderer/contexts/CameraSessionContext'
import { useCameraStore } from '@renderer/stores/camera'
import { resizeCamera, createCameraCover } from '@renderer/lib/camera-transform'
import type { CameraTransform } from '@shared/camera'

type Corner = 'nw' | 'ne' | 'sw' | 'se'
const control =
  'rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-40'
function videoError(): void {
  useCameraStore.setState({ error: 'playback' })
}

function cameraDimensions(width: number, height: number): void {
  if (width <= 0 || height <= 0) return
  const state = useCameraStore.getState()
  const cover = createCameraCover(width, height)
  if (cover.width === state.cover.width && cover.height === state.cover.height) return
  const zoom = state.transform.width / state.cover.width
  const w = cover.width * zoom
  const h = cover.height * zoom
  useCameraStore.setState({
    cover,
    transform: {
      x: state.transform.x + (state.transform.width - w) / 2,
      y: state.transform.y + (state.transform.height - h) / 2,
      width: w,
      height: h
    }
  })
}

export default function CameraWorkspacePage(): React.JSX.Element {
  const { t } = useTranslation()
  const camera = useCameraSession()
  const state = useCameraStore()
  const canvas = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; frame: CameraTransform; corner?: Corner } | null>(
    null
  )
  const begin = (event: React.PointerEvent<HTMLDivElement>, corner?: Corner): void => {
    if (!camera.stream || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    canvas.current?.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, frame: state.transform, corner }
  }
  const move = (event: React.PointerEvent<HTMLDivElement>): void => {
    const start = drag.current
    const bounds = canvas.current?.getBoundingClientRect()
    if (!start || !bounds?.width) return
    const dx = ((event.clientX - start.x) * 1920) / bounds.width
    const dy = ((event.clientY - start.y) * 1920) / bounds.width
    if (start.corner) {
      const ratio = start.frame.height / start.frame.width
      const delta =
        (dx * (start.corner.endsWith('w') ? -1 : 1) +
          dy * (start.corner.startsWith('n') ? -1 : 1) * ratio) /
        (1 + ratio * ratio)
      state.updateTransform(
        resizeCamera(start.frame, start.corner, start.frame.width + delta, state.cover.width)
      )
    } else state.updateTransform({ ...start.frame, x: start.frame.x + dx, y: start.frame.y + dy })
  }
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4" aria-label={t('camera.title')}>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/files" className={control}>
          {t('camera.back')}
        </Link>
        <h1 className="mr-auto text-xl font-semibold">{t('camera.title')}</h1>
        <span role="status" className="text-sm text-muted">
          {t(`camera.${state.connection}`)}
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          {t('camera.source')}
          <select
            className={control}
            value={state.deviceId}
            disabled={state.busy}
            onChange={(event) => {
              if (event.target.value) void camera.selectSource(event.target.value)
            }}
          >
            <option value="">{t('camera.choose')}</option>
            {state.devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
        <button className={control} disabled={state.busy} onClick={() => void camera.enable()}>
          {t('camera.enable')}
        </button>
        <button className={control} disabled={!camera.stream} onClick={camera.reset}>
          {t('camera.reset')}
        </button>
        <button
          className={`${control} bg-accent text-accent-foreground`}
          disabled={!camera.stream || state.busy}
          onClick={() => void camera.start()}
        >
          {t('camera.start')}
        </button>
        <button
          className={control}
          disabled={state.connection === 'idle'}
          onClick={() => void camera.stop()}
        >
          {t('camera.stop')}
        </button>
      </div>
      {state.error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-danger p-3 text-sm"
        >
          <span>
            {t(`camera.errors.${state.error}`, { defaultValue: t('camera.errors.unavailable') })}
          </span>
          <button
            className={control}
            onClick={() => {
              if (camera.stream) camera.retry()
              else void camera.selectSource(state.deviceId)
            }}
          >
            {t('camera.retry')}
          </button>
        </div>
      )}
      <div
        ref={canvas}
        role="group"
        aria-label={t('camera.canvas')}
        tabIndex={0}
        data-testid="camera-editor"
        className="relative w-full touch-none overflow-hidden rounded-lg bg-black outline-none focus:ring-2 focus:ring-accent"
        style={{
          aspectRatio: '16 / 9',
          width: 'min(100%, max(320px, calc((100dvh - 260px) * 16 / 9)))',
          alignSelf: 'center'
        }}
        onPointerDown={(event) => begin(event)}
        onPointerMove={move}
        onPointerUp={(event) => {
          move(event)
          drag.current = null
          if (canvas.current?.hasPointerCapture(event.pointerId))
            canvas.current.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onKeyDown={(event) => {
          const delta = event.shiftKey ? 10 : 1
          const offset = {
            ArrowLeft: [-delta, 0],
            ArrowRight: [delta, 0],
            ArrowUp: [0, -delta],
            ArrowDown: [0, delta]
          }[event.key]
          if (offset && camera.stream) {
            event.preventDefault()
            state.updateTransform({
              ...state.transform,
              x: state.transform.x + offset[0],
              y: state.transform.y + offset[1]
            })
          }
        }}
      >
        <CameraStage
          stream={camera.stream}
          transform={state.transform}
          onError={videoError}
          onDimensions={cameraDimensions}
        />
        {!camera.stream && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-white/60">
            {t('camera.empty')}
          </p>
        )}
        {camera.stream && (
          <div
            className="pointer-events-none absolute border-2 border-accent"
            style={{
              left: `${(state.transform.x / 1920) * 100}%`,
              top: `${(state.transform.y / 1080) * 100}%`,
              width: `${(state.transform.width / 1920) * 100}%`,
              height: `${(state.transform.height / 1080) * 100}%`
            }}
          ></div>
        )}
        {camera.stream &&
          (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
            <div
              key={corner}
              data-testid={`camera-resize-${corner}`}
              onPointerDown={(event) => begin(event, corner)}
              className="absolute size-4 border border-white bg-accent"
              style={{
                left: `${(Math.max(12, Math.min(1908, state.transform.x + (corner.endsWith('e') ? state.transform.width : 0))) / 1920) * 100}%`,
                top: `${(Math.max(12, Math.min(1068, state.transform.y + (corner.startsWith('s') ? state.transform.height : 0))) / 1080) * 100}%`,
                transform: 'translate(-50%, -50%)',
                cursor: `${corner}-resize`
              }}
            />
          ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <p className="mr-auto text-sm text-muted">{t('camera.hint')}</p>
        {(['x', 'y', 'width'] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            {t(`camera.${key}`)}
            <input
              className={`${control} w-28`}
              type="number"
              step="1"
              disabled={!camera.stream}
              value={Math.round(state.transform[key])}
              onChange={(event) => {
                if (!event.target.value) return
                const value = Number(event.target.value)
                state.updateTransform(
                  key === 'width'
                    ? resizeCamera(state.transform, 'se', value, state.cover.width)
                    : { ...state.transform, [key]: value }
                )
              }}
            />
          </label>
        ))}
      </div>
    </section>
  )
}
