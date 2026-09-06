import { Select } from '@heroui/react/select'
import { ListBox } from '@heroui/react/list-box'
import { useTranslation } from 'react-i18next'
import { useCameraSession } from '@renderer/contexts/CameraSessionContext'
import { useCameraStore } from '@renderer/stores/camera'

export default function CameraSelector(): React.JSX.Element {
  const { t } = useTranslation()
  const camera = useCameraSession()
  const { devices, deviceId, busy, selectorOpen } = useCameraStore()
  return (
    <Select
      aria-label={t('camera.choose')}
      placeholder={t('camera.choose')}
      value={devices.some((device) => device.id === deviceId) ? deviceId : null}
      isOpen={selectorOpen}
      onOpenChange={(open) => {
        useCameraStore.setState({ selectorOpen: open })
      }}
      onChange={(key) => {
        if (key && !busy) void camera.selectSource(String(key))
      }}
      className="w-64 max-w-full"
    >
      <Select.Trigger
        data-testid="camera-source-selector"
        onPress={() => {
          if (selectorOpen) return
          void camera.prepareSources().then(() => useCameraStore.setState({ selectorOpen: true }))
        }}
        className="rounded-full h-10 items-center text-foreground bg-transparent border border-border hover:bg-default/60 transition-colors"
      >
        <Select.Value className="flex min-w-0 justify-center truncate" />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-busy={busy}>
          {devices
            .filter((device) => device.id)
            .map((device) => (
              <ListBox.Item
                key={device.id}
                id={device.id}
                textValue={device.label}
                isDisabled={busy}
                className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
              >
                {device.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
