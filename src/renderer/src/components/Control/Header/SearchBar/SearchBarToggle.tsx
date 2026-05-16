import BibleSearchBar from './BibleSearchBar'
import FileExplorerSearchBar from './FileExplorerSearchBar'

type SearchBarVariant = 'bible' | 'fileExplorer'

interface SearchBarToggleProps {
  variant: SearchBarVariant
}

export default function SearchBarToggle({ variant }: SearchBarToggleProps): React.JSX.Element {
  if (variant === 'bible') return <BibleSearchBar />
  return <FileExplorerSearchBar />
}
