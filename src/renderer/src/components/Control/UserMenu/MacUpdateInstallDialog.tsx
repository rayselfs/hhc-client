import { Button } from '@heroui/react/button'
import { Modal } from '@heroui/react/modal'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

interface MacUpdateInstallDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const GATEKEEPER_COMMAND = 'xattr -dr com.apple.quarantine "/Applications/HHC Presenter.app"'

export default function MacUpdateInstallDialog(
  props: MacUpdateInstallDialogProps
): React.JSX.Element {
  const { isOpen, onOpenChange } = props
  const { t } = useTranslation()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const copyCommand = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(GATEKEEPER_COMMAND)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) setCopyStatus('idle')
        onOpenChange(open)
      }}
    >
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t('macUpdate.title')}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <ShortcutScope name="overlay">
              <div className="space-y-4 text-sm">
                <p>{t('macUpdate.dmgOpened')}</p>
                <p className="font-medium">{t('macUpdate.openAnyway')}</p>
                <p>{t('macUpdate.fallback')}</p>
                <code className="block overflow-x-auto rounded-xl bg-default-100 p-3 text-xs">
                  {GATEKEEPER_COMMAND}
                </code>
                <p className="text-warning">{t('macUpdate.gatekeeperWarning')}</p>
              </div>
            </ShortcutScope>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={() => void copyCommand()}>
              {copyStatus === 'copied'
                ? t('macUpdate.commandCopied')
                : copyStatus === 'error'
                  ? t('macUpdate.copyFailed')
                  : t('macUpdate.copyCommand')}
            </Button>
            <Button onPress={() => onOpenChange(false)}>{t('common.close')}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
