import { beforeEach, describe, expect, it } from 'vitest'
import { getBibleProjectionSettingsPayload } from '../bible-projection-settings'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'

describe('getBibleProjectionSettingsPayload', () => {
  beforeEach(() => {
    useBibleSettingsStore.setState({
      fontSize: 96,
      scriptureDisplayMode: 'lower-third',
      scriptureTemplateId: 'warm-sermon'
    })
  })

  it('resolves persisted scripture settings into a projection payload', () => {
    expect(getBibleProjectionSettingsPayload()).toEqual({
      fontSize: 96,
      displayMode: 'lower-third',
      templateTheme: expect.objectContaining({
        id: 'warm-sermon',
        backgroundColor: '#1c140d'
      })
    })
  })
})
