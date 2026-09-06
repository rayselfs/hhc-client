import { afterEach, describe, expect, it } from 'vitest'
import { getExplorerProjectionPlaylist } from '../file-explorer-projection'
import { useFileExplorerSettings } from '@renderer/stores/file-explorer'
import { useSettingsStore } from '@renderer/stores/settings'
import type { FileItemRecord } from '@shared/types/folder'

const settings = useFileExplorerSettings.getState()
const timezone = useSettingsStore.getState().timezone
const file = (id: string, name: string, day: number): FileItemRecord => ({
  id,
  name,
  type: 'file',
  mimeType: 'image/png',
  parentId: 'file-root',
  sortIndex: 0,
  createdAt: Date.UTC(2026, 8, day),
  expiresAt: null,
  size: 1,
  url: `blob:${id}`
})

afterEach(() => {
  useFileExplorerSettings.setState(settings)
  useSettingsStore.setState({ timezone })
})

describe('grouped explorer projection', () => {
  it('sorts within a fixed date order and scopes every target to its own group', () => {
    const files = [file('a1', 'Z', 1), file('a2', 'A', 1), file('b1', 'Z', 2), file('b2', 'A', 2)]
    useSettingsStore.setState({ timezone: 'UTC' })
    const setDisplay = (sortDir: 'asc' | 'desc'): void => {
      useFileExplorerSettings.setState({
        folderDisplay: {
          'file-root': { groupMode: 'date', groupSortDir: 'desc', sortField: 'name', sortDir }
        }
      })
    }
    setDisplay('asc')
    expect(getExplorerProjectionPlaylist(files).map((file) => file.id)).toEqual(['b2', 'b1'])
    expect(getExplorerProjectionPlaylist(files, files[1]).map((file) => file.id)).toEqual([
      'a2',
      'a1'
    ])
    setDisplay('desc')
    expect(getExplorerProjectionPlaylist(files).map((file) => file.id)).toEqual(['b1', 'b2'])
    expect(getExplorerProjectionPlaylist(files, files[1]).map((file) => file.id)).toEqual([
      'a1',
      'a2'
    ])
  })

  it('migrates the old grouped direction without borrowing ungrouped item ordering', async () => {
    const migrate = useFileExplorerSettings.persist.getOptions().migrate!
    const result = await migrate(
      {
        folderDisplay: {
          grouped: { groupMode: 'date', sortDir: 'asc' },
          ordinary: { groupMode: 'none', sortDir: 'asc' }
        }
      },
      3
    )
    expect(result).toMatchObject({
      folderDisplay: {
        grouped: { groupSortDir: 'asc' },
        ordinary: { groupSortDir: 'desc' }
      }
    })
  })
})
