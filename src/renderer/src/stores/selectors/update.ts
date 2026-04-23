import type { UpdateStore } from '@renderer/stores/update'

export const selectUpdateStatus = (s: UpdateStore): string => s.status

export const selectAvailableVersion = (s: UpdateStore): string | null => s.availableVersion

export const selectIsUpdateAvailable = (s: UpdateStore): boolean => s.status === 'available'
