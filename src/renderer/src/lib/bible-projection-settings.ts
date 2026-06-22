import { getSlideTemplate } from '@renderer/lib/slide-templates'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import type { ProjectionPayload } from '@shared/projection-messages'

export function getBibleProjectionSettingsPayload(): ProjectionPayload<'bible:settings'> {
  const settings = useBibleSettingsStore.getState()
  const template = getSlideTemplate(settings.scriptureTemplateId)

  return {
    fontSize: settings.fontSize,
    templateTheme: template?.theme
  }
}
