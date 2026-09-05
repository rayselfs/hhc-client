import type { SortDir } from '@renderer/stores/file-explorer'

export function groupItemsByDate<T extends { createdAt?: number }>(
  items: T[],
  timezone: string,
  direction: SortDir
): Array<T & { dateGroup: string }> {
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const groups = new Map<string, Array<T & { dateGroup: string }>>()
  for (const item of items) {
    let dateGroup = ''
    if (item.createdAt !== undefined && Number.isFinite(new Date(item.createdAt).getTime())) {
      const parts = formatter.formatToParts(item.createdAt)
      dateGroup = ['year', 'month', 'day']
        .map((type) => parts.find((part) => part.type === type)?.value)
        .join('/')
    }
    const group = groups.get(dateGroup) ?? []
    group.push({ ...item, dateGroup })
    groups.set(dateGroup, group)
  }
  return [...groups.keys()]
    .sort((a, b) => (!a ? 1 : !b ? -1 : (direction === 'asc' ? 1 : -1) * a.localeCompare(b)))
    .flatMap((key) => groups.get(key) ?? [])
}
