export const km = (value: number) =>
  value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export function duration(value: number) {
  const seconds = Math.round(value)
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
export const pace = (value: number | null) => (value === null ? '—' : duration(value))
export function lapDuration(value: number) {
  const fraction = value
    .toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 })
    .split('.')[1]
  return `${duration(Math.floor(value))}${fraction ? `.${fraction}` : ''}`
}
export const dateLabel = (
  value: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) =>
  new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'Asia/Tokyo' }).format(
    new Date(value.length === 10 ? `${value}T12:00:00+09:00` : value),
  )
