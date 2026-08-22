import { AlertDialog } from '@heroui/react/alert-dialog'
import { Button } from '@heroui/react/button'
import { useTranslation } from 'react-i18next'
import { usePendingPresentationCloseDecision } from '@renderer/contexts/PresentationCloseDecisionContext'

export default function PresentationCloseDecisionDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const pending = usePendingPresentationCloseDecision()

  return (
    <AlertDialog.Backdrop isOpen={pending !== null} isDismissable={false}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>
              {t('presentationWorkspace.closeDecisionTitle', 'Presentation could not be saved')}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              {t(
                'presentationWorkspace.closeDecisionBody',
                'Retry saving, keep editing, or close without saving your latest changes.'
              )}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={() => pending?.resolve('keep-editing')}>
              {t('presentationWorkspace.keepEditing', 'Keep editing')}
            </Button>
            <Button variant="primary" onPress={() => pending?.resolve('retry')}>
              {t('presentationWorkspace.retrySave', 'Retry save')}
            </Button>
            <Button variant="danger" onPress={() => pending?.resolve('discard')}>
              {t('presentationWorkspace.closeWithoutSaving', 'Close without saving')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
