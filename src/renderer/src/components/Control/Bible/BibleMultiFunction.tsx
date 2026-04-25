import React, { useState } from 'react'
import { Card } from '@heroui/react/card'
import { Tabs } from '@heroui/react/tabs'
import { Button } from '@heroui/react/button'
import { Breadcrumbs } from '@heroui/react/breadcrumbs'
import { Trash2, FolderPlus, ChevronLeft, Clock, FolderOpen } from 'lucide-react'
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

  const folderPath = getFolderPath(currentFolderId).slice(1)

  return (
    <Card className="flex flex-col h-full flex-1 max-lg:flex-[2] p-0 gap-2">
      <Card.Header className="shrink-0 flex-row! items-center p-0 pt-2">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(String(key))}
          className="pl-2 pr-1"
        >
          <Tabs.ListContainer>
            <Tabs.List
              aria-label={t('bible.functionsLabel')}
              className="bg-transparent border border-border p-1"
            >
              <Tabs.Tab
                id="history"
                className="data-[selected=true]:text-accent-foreground max-lg:w-8 max-lg:px-0"
              >
                <span className="max-lg:hidden">{t('bible.history.title')}</span>
                <Clock size={20} className="lg:hidden" />
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
              <Tabs.Tab
                id="custom"
                className="data-[selected=true]:text-accent-foreground max-lg:w-8 max-lg:px-0"
              >
                <span className="max-lg:hidden">{t('bible.custom.title')}</span>
                <FolderOpen size={20} className="lg:hidden" />
                <Tabs.Indicator className="bg-accent" />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {activeTab === 'custom' && (
          <>
            <Breadcrumbs className="max-lg:hidden">
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
            <div className="lg:hidden flex items-center gap-1 min-w-0">
              {folderPath.length > 0 && (
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    if (folderPath.length <= 1) {
                      navigateToRoot()
                    } else {
                      navigateToFolder(folderPath[folderPath.length - 2].id)
                    }
                  }}
                  aria-label={t('common.back', 'Back')}
                >
                  <ChevronLeft size={16} />
                </Button>
              )}
              <span className="text-sm truncate">
                {folderPath.length === 0
                  ? t('bible.custom.home', 'Home')
                  : folderPath[folderPath.length - 1].name}
              </span>
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0 pr-3">
          {activeTab === 'history' && (
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              onPress={clearHistory}
              aria-label={t('bible.history.clearHistory', 'Clear history')}
            >
              <Trash2 size={18} />
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
              <FolderPlus size={18} />
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
