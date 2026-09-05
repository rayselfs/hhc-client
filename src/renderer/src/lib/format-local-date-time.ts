export function formatLocalDateTime(timestamp: number | undefined): string {
  if (timestamp === undefined || !Number.isFinite(timestamp)) return '—'
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return '—'
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
