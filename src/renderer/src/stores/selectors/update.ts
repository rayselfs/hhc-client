import type { UpdateStore } from '@renderer/stores/update'
import type { UpdateStatus } from '@shared/ipc-channels'

export const selectUpdateStatus = (s: UpdateStore): UpdateStatus => s.status

export const selectAvailableVersion = (s: UpdateStore): string | null => s.availableVersion
