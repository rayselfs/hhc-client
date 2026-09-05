import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import type { FolderRecord } from '@shared/types/folder'

export interface BreadcrumbProps {
  currentFolderId: string
  getFolderPath: (id: string) => FolderRecord[]
  onNavigate: (folderId: string | null) => void
}

export default function Breadcrumb({
  currentFolderId,
  getFolderPath,
  onNavigate
}: BreadcrumbProps): React.JSX.Element {
  const { t } = useTranslation()
  const path = getFolderPath(currentFolderId).filter((folder) => folder.parentId !== null)

  return (
    <nav
      aria-label={t('fileExplorer.breadcrumb.label')}
      className="flex items-center gap-0.5 min-w-0 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className="shrink-0 text-base text-foreground/70 hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-default/60"
      >
        {t('fileExplorer.breadcrumb.root')}
      </button>

      {path.map((folder, index) => {
        const isLast = index === path.length - 1
        return (
          <React.Fragment key={folder.id}>
            <ChevronRight size={12} className="shrink-0 text-foreground/40" aria-hidden="true" />
            {isLast ? (
              <span className="text-base font-medium text-foreground truncate px-1 py-0.5">
                {folder.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(folder.id)}
                className="text-base text-foreground/70 hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-default/60 truncate max-w-[120px]"
              >
                {folder.name}
              </button>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
