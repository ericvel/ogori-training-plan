import type { Activity } from './model.ts'
import { validDate } from './model.ts'

// A real CSV state machine: Garmin quotes Steps ("6,448") and may quote titles/newlines.
export function readCsv(text: string): string[][] {
  if (text.length > 2_000_000)
    throw new Error('CSV is too large. Export fewer than 10,000 activities.')
  const source = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
        closed = true
      } else field += c
    } else if (c === '"') {
      if (field || closed) throw new Error(`Invalid quote on CSV row ${rows.length + 1}.`)
      quoted = true
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field)
      field = ''
      closed = false
      if (c !== ',') {
        if (c === '\r' && source[i + 1] === '\n') i++
        if (row.some((s) => s.trim())) rows.push(row)
        row = []
      }
    } else {
      if (closed) throw new Error(`Unexpected text after a quote on CSV row ${rows.length + 1}.`)
      field += c
    }
  }
  if (quoted) throw new Error('CSV has an unfinished quoted field.')
  row.push(field)
  if (row.some((s) => s.trim())) rows.push(row)
  if (rows.length > 10001) throw new Error('CSV contains more than 10,000 activities.')
  return rows
}
export function metric(value: string | undefined): number | null {
  const text = (value ?? '')
    .trim()
    .replace(/^'(?=-?\d)/, '')
    .replaceAll(',', '')
  if (!text || text === '--') return null
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`Invalid number: ${value}`)
  const number = Number(text)
  if (!Number.isFinite(number)) throw new Error('Number is out of range.')
  return number
}
export function seconds(value: string | undefined): number | null {
  const text = (value ?? '').trim()
  if (!text || text === '--') return null
  if (!/^\d+:\d{2}(:\d{2})?(\.\d+)?$/.test(text)) throw new Error(`Invalid duration: ${text}`)
  const parts = text.split(':').map(Number)
  if (parts.slice(1).some((p) => p >= 60)) throw new Error(`Invalid duration: ${text}`)
  return parts.reduce((total, p) => total * 60 + p, 0)
}
export function parseGarmin(text: string): Activity[] {
  const rows = readCsv(text)
  const headers = rows.shift()?.map((h) => h.trim()) ?? []
  const required = ['Activity Type', 'Date', 'Title', 'Distance', 'Time']
  if (required.some((h) => !headers.includes(h))) {
    throw new Error(
      'Choose Garmin’s activity-overview CSV. Required columns: Activity Type, Date, Title, Distance, Time.',
    )
  }
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate column names.')
  if (!rows.length) throw new Error('CSV contains no activities.')
  return rows.map((row, index) => {
    try {
      if (row.length !== headers.length) throw new Error('Column count does not match the header.')
      const raw = Object.fromEntries(headers.map((h, i) => [h, row[i]!.trim()]))
      const date = raw.Date!
      if (
        !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date) ||
        !validDate(date.slice(0, 10)) ||
        Number(date.slice(11, 13)) > 23 ||
        Number(date.slice(14, 16)) > 59 ||
        Number(date.slice(17, 19)) > 59
      ) {
        throw new Error('Date must be YYYY-MM-DD HH:MM:SS.')
      }
      const type = raw['Activity Type']!
      if (!type || type.length > 100 || raw.Title!.length > 2000)
        throw new Error('Invalid activity type or title.')
      const distanceKm = metric(raw.Distance),
        durationSeconds = seconds(raw.Time)
      if (distanceKm === null || distanceKm < 0 || distanceKm > 2000 || durationSeconds === null) {
        throw new Error('Distance and Time must contain non-negative values.')
      }
      const startedAt = `${date.replace(' ', 'T')}+09:00`
      const averageHr = metric(raw['Avg HR']),
        maxHr = metric(raw['Max HR'])
      if ([averageHr, maxHr].some((n) => n !== null && (n < 0 || n > 300)))
        throw new Error('Invalid heart rate.')
      // Garmin overview exports omit activity IDs. Mutable titles must not affect identity.
      const id = `${type.toLowerCase()}:${startedAt}`
      return {
        id,
        type,
        startedAt,
        title: raw.Title!,
        distanceKm,
        durationSeconds,
        paceSeconds: seconds(raw['Avg Pace']),
        averageHr,
        maxHr,
        sessionId: null,
        linkSource: null,
        raw,
      }
    } catch (error) {
      throw new Error(
        `CSV row ${index + 2}: ${error instanceof Error ? error.message : 'Invalid activity.'}`,
      )
    }
  })
}
