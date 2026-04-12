import React from 'react'
import BibleSelector from './BibleSelector'

export default function BibleHeaderControls(): React.JSX.Element {
  const handleOpenDialog = (): void => {
    // Dialog will be added in a future task
    console.log('Open dialog')
  }

  return (
    <div data-testid="bible-header-controls">
      <BibleSelector onOpenDialog={handleOpenDialog} />
    </div>
  )
}
