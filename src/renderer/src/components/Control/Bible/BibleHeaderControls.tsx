import React from 'react'
import BibleSelector from './BibleSelector'

export default function BibleHeaderControls(): React.JSX.Element {
  const handleOpenDialog = (): void => {
    window.dispatchEvent(new Event('open-bible-selector'))
  }

  return (
    <div data-testid="bible-header-controls">
      <BibleSelector onOpenDialog={handleOpenDialog} />
    </div>
  )
}
