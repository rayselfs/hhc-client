import { getBibleProjectionTemplate } from '@renderer/lib/bible-projection-templates'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import type { ProjectionPayload } from '@shared/projection-messages'

export function getBibleProjectionSettingsPayload(): ProjectionPayload<'bible:settings'> {
  const settings = useBibleSettingsStore.getState()
  const template = getBibleProjectionTemplate(settings.scriptureTemplateId)

  return {
    fontSize: settings.fontSize,
    templateTheme: template?.theme
  }
}
