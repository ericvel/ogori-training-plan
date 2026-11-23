import { metric, readCsv, seconds } from './csv.ts'
import { assertLapData } from './model.ts'
import type { Activity, ActivityLap, LapData } from './model.ts'

const missing = (text: string | undefined) => !text || text === '--'

/** Garmin exports both flat lap lists and workout steps with aggregate range rows. */
export function parseGarminLaps(csv: string): LapData {
  const rows = readCsv(csv)
  const headers = rows.shift()?.map((header) => header.trim()) ?? []
  const lapHeader = headers.includes('Lap') ? 'Lap' : 'Laps'
  if (!headers.includes(lapHeader) || !['Time', 'Distance'].every((key) => headers.includes(key)))
    throw new Error(
      'Choose an individual Garmin activity CSV with Lap or Laps, Time, and Distance columns.',
    )
  if (
    new Set(headers).size !== headers.length ||
    (headers.includes('Lap') && headers.includes('Laps'))
  )
    throw new Error('CSV has duplicate or ambiguous lap columns.')
  const laps: ActivityLap[] = []
  const groups: { first: number; last: number; stepType: string }[] = []
  let totals: LapData['totals'] | undefined
  for (const [index, row] of rows.entries()) {
    try {
      if (row.length !== headers.length) throw new Error('Column count does not match the header.')
      const values = Object.fromEntries(headers.map((key, i) => [key, row[i]!.trim()]))
      const numberText = values[lapHeader]!
      const summary = numberText === 'Summary' || values.Interval === 'Summary'
      const range = /^(\d+)\s*-\s*(\d+)$/.exec(numberText)
      if (range) {
        const first = Number(range[1]),
          last = Number(range[2])
        if (
          !Number.isSafeInteger(first) ||
          !Number.isSafeInteger(last) ||
          first < 1 ||
          last <= first ||
          missing(values['Step Type']) ||
          values['Step Type']!.length > 100
        )
          throw new Error('Invalid workout lap group.')
        groups.push({ first, last, stepType: values['Step Type']! })
        continue
      }
      const distanceKm = metric(values.Distance),
        durationSeconds = seconds(values.Time)
      if (distanceKm === null || distanceKm < 0 || distanceKm > 2000 || durationSeconds === null)
        throw new Error('Distance and Time must contain non-negative values.')
      if (summary) {
        if (totals || /^\d+$/.test(numberText)) throw new Error('Invalid or duplicate summary row.')
        totals = { distanceKm, durationSeconds }
        continue
      }
      if (!/^\d+$/.test(numberText)) throw new Error('Expected an individual lap number.')
      const intervalText = values.Interval
      if (!missing(intervalText) && !/^\d+$/.test(intervalText!))
        throw new Error('Invalid interval number.')
      laps.push({
        number: Number(numberText),
        stepType: missing(values['Step Type']) ? null : values['Step Type']!,
        interval: missing(intervalText) ? null : Number(intervalText),
        distanceKm,
        durationSeconds,
        paceSeconds: seconds(values['Avg Pace']),
        averageHr: metric(values['Avg HR']),
        maxHr: metric(values['Max HR']),
      })
    } catch (cause) {
      throw new Error(
        `CSV row ${index + 2}: ${cause instanceof Error ? cause.message : 'Invalid lap.'}`,
      )
    }
  }
  // Groups carry labels, never additional distance or time. Reject incomplete/overlapping groups.
  const grouped = new Set<number>()
  for (const group of groups) {
    const children = laps.filter((lap) => lap.number >= group.first && lap.number <= group.last)
    if (children.length !== group.last - group.first + 1)
      throw new Error('Workout group is missing individual laps.')
    for (const lap of children) {
      if (grouped.has(lap.number)) throw new Error('Workout lap groups overlap.')
      if (lap.stepType !== null && lap.stepType !== group.stepType)
        throw new Error('Workout group conflicts with an individual lap label.')
      grouped.add(lap.number)
      if (lap.stepType === null) lap.stepType = group.stepType
    }
  }
  const data = {
    laps,
    totals:
      totals ??
      laps.reduce(
        (sum, lap) => ({
          distanceKm: sum.distanceKm + lap.distanceKm,
          durationSeconds: sum.durationSeconds + lap.durationSeconds,
        }),
        { distanceKm: 0, durationSeconds: 0 },
      ),
  }
  assertLapData(data)
  return data
}

export function lapMismatch(
  activity: Pick<Activity, 'distanceKm' | 'durationSeconds'>,
  data: LapData,
): boolean {
  // Small epsilon prevents decimal representation errors at the inclusive tolerance boundary.
  return (
    Math.abs(activity.distanceKm - data.totals.distanceKm) >
      Math.max(0.1, activity.distanceKm * 0.01) + 1e-9 ||
    Math.abs(activity.durationSeconds - data.totals.durationSeconds) >
      Math.max(5, activity.durationSeconds * 0.01) + 1e-9
  )
}

export function sameLapData(a: LapData | undefined, b: LapData): boolean {
  return (
    !!a &&
    a.totals.distanceKm === b.totals.distanceKm &&
    a.totals.durationSeconds === b.totals.durationSeconds &&
    a.laps.length === b.laps.length &&
    a.laps.every((lap, i) =>
      (Object.keys(lap) as (keyof ActivityLap)[]).every((key) => lap[key] === b.laps[i]![key]),
    )
  )
}

export const isWorkLap = (lap: ActivityLap) =>
  lap.stepType?.toLowerCase() === 'run' && lap.interval !== null
