import { Card, Tabs } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { HistoryTab } from './HistoryTab'
import { CustomFolderTab } from './CustomFolderTab'

export default function BibleMultiFunction(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Card className="h-full flex-1 flex flex-col">
      <Tabs className="flex-1 flex flex-col min-h-0">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Bible Functions">
            <Tabs.Tab id="history">
              {t('bible.history.title')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="custom">
              {t('bible.custom.title')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="history" className="flex-grow h-0 overflow-hidden">
          <HistoryTab />
        </Tabs.Panel>
        <Tabs.Panel id="custom" className="flex-grow h-0 overflow-hidden">
          <CustomFolderTab />
        </Tabs.Panel>
      </Tabs>
    </Card>
  )
}
