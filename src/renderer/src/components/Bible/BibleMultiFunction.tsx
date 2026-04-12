import { Card, Tabs } from '@heroui/react'
import { HistoryTab } from './HistoryTab'
import { CustomFolderTab } from './CustomFolderTab'

export default function BibleMultiFunction(): React.JSX.Element {
  return (
    <Card className="h-full w-[400px] flex flex-col">
      <Tabs className="h-full flex flex-col">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Bible Functions">
            <Tabs.Tab id="history">歷史</Tabs.Tab>
            <Tabs.Tab id="custom">自訂</Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="history" className="flex-grow h-0">
          <HistoryTab />
        </Tabs.Panel>
        <Tabs.Panel id="custom" className="flex-grow h-0">
          <CustomFolderTab />
        </Tabs.Panel>
      </Tabs>
    </Card>
  )
}
