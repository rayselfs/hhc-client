import React, { useState } from 'react'
import { Card, Tabs, Button, Breadcrumbs } from '@heroui/react'
import { Trash2, FolderPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { HistoryTab } from './HistoryTab'
import { CustomFolderTab } from './CustomFolderTab'

export default function BibleMultiFunction(): React.JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>('history')
  const [isAddFolderModalOpen, setAddFolderModalOpen] = useState(false)

  const clearHistory = useBibleHistoryStore((state) => state.clearHistory)
  const { currentFolderId, navigateToRoot, navigateToFolder, getFolderPath } = useBibleFolderStore()

  const folderPath = getFolderPath().slice(1)

  return (
    <Card className="h-full flex-1 flex flex-col p-0">
      <Card.Header className="shrink-0 flex-row! items-center gap-1 p-0 pt-3 px-3">
        <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key))}>
          <Tabs.ListContainer>
            <Tabs.List
              aria-label="Bible Functions"
              className="bg-transparent border border-border p-1"
            >
              <Tabs.Tab id="history">
                {t('bible.history.title')}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab id="custom">
                {t('bible.custom.title')}
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {activeTab === 'custom' && (
          <Breadcrumbs>
            <Breadcrumbs.Item onPress={navigateToRoot}>
              {t('bible.custom.home', 'Home')}
            </Breadcrumbs.Item>
            {folderPath.map((folder) => (
              <Breadcrumbs.Item
                key={folder.id}
                onPress={
                  folder.id !== currentFolderId ? () => navigateToFolder(folder.id) : undefined
                }
              >
                {folder.name}
              </Breadcrumbs.Item>
            ))}
          </Breadcrumbs>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          {activeTab === 'history' && (
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              onPress={clearHistory}
              aria-label={t('bible.history.clearHistory', 'Clear history')}
            >
              <Trash2 size={15} />
            </Button>
          )}
          {activeTab === 'custom' && (
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              onPress={() => setAddFolderModalOpen(true)}
              aria-label={t('bible.custom.newFolder', 'New Folder')}
            >
              <FolderPlus size={15} />
            </Button>
          )}
        </div>
      </Card.Header>

      <GlassDivider />

      <Card.Content className="flex-1 min-h-0 overflow-hidden p-0">
        {activeTab === 'history' ? (
          <HistoryTab />
        ) : (
          <CustomFolderTab
            isModalOpen={isAddFolderModalOpen}
            onModalOpenChange={setAddFolderModalOpen}
          />
        )}
      </Card.Content>
    </Card>
  )
}
