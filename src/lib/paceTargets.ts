import { hasWorkoutSteps, isWorkLap } from '../../shared/laps.ts'
import type { Activity, ActivityLap, Plan } from '../../shared/model.ts'
import { addDays } from '../../shared/model.ts'
import { pace } from './format.ts'

export type PaceKind = 'easy' | 'tempo' | 'tenKm' | 'half'
export interface PaceEstimates {
  ranges: Partial<Record<PaceKind, string>>
  runCount: number
  lapRunCount: number
  latestDate: string
}

type RunTotals = Pick<Activity, 'distanceKm' | 'durationSeconds'>

const range = (fast: number, slow: number) =>
  `${pace(Math.floor(fast / 5) * 5)}–${pace(Math.ceil(slow / 5) * 5)}`
const secondsPerKm = (run: RunTotals) => run.durationSeconds / run.distanceKm
const hasPlausiblePace = (run: RunTotals) => {
  const value = secondsPerKm(run)
  return value >= 150 && value <= 900
}
const tenKmEquivalent = (run: RunTotals) => secondsPerKm(run) * (10 / run.distanceKm) ** 0.07

function sustainedWork(laps: ActivityLap[]): RunTotals | null {
  const intervals: ActivityLap[] = []
  for (const lap of [...laps].sort((a, b) => a.number - b.number)) {
    if (!isWorkLap(lap)) continue
    const previous = intervals.at(-1)
    // Garmin grouped steps can have several consecutive Run laps with no interval number.
    if (previous && previous.interval === lap.interval && previous.number === lap.number - 1) {
      previous.number = lap.number
      previous.distanceKm += lap.distanceKm
      previous.durationSeconds += lap.durationSeconds
    } else {
      intervals.push({ ...lap })
    }
  }
  const totals = { distanceKm: 0, durationSeconds: 0 }
  for (const interval of intervals) {
    // Exclude strides and other short bursts, even within a sustained workout.
    if (interval.durationSeconds < 120 || !hasPlausiblePace(interval)) continue
    totals.distanceKm += interval.distanceKm
    totals.durationSeconds += interval.durationSeconds
  }
  return totals.durationSeconds >= 600 ? totals : null
}

export function estimatePaces(plan: Plan, activities: Activity[]): PaceEstimates | null {
  const sessions = new Map(
    plan.weeks.flatMap((week) => week.sessions.map((s) => [s.id, s] as const)),
  )
  const running = activities.filter(
    (a) => a.type.toLowerCase() === 'running' && a.distanceKm >= 3 && a.durationSeconds >= 1200,
  )
  const latestDate = running
    .map((a) => a.startedAt.slice(0, 10))
    .sort()
    .at(-1)
  if (!latestDate) return null
  const cutoff = addDays(latestDate, -56)
  const recent = running.filter((a) => a.startedAt.slice(0, 10) >= cutoff)
  const equivalents: number[] = []
  const easyPaces: number[] = []
  let lapRunCount = 0
  for (const activity of recent) {
    const laps = activity.lapData?.laps
    if (laps && hasWorkoutSteps(laps)) {
      const work = sustainedWork(laps)
      if (work) {
        equivalents.push(tenKmEquivalent(work))
        lapRunCount++
      }
      continue
    }

    const session = activity.sessionId ? sessions.get(activity.sessionId) : undefined
    // Mixed workout averages include warm-up, recovery and cool-down time.
    if (
      /tempo|[×x]\s*\d|strides|interval|pace\/effort|half-marathon effort/i.test(
        session?.title ?? activity.title,
      ) ||
      !hasPlausiblePace(activity)
    )
      continue

    equivalents.push(tenKmEquivalent(activity))
    if (
      session &&
      session.kind !== 'Race' &&
      (/\b(?:easy|long run)\b/i.test(session.title) ||
        session.instructions?.some((instruction) => instruction.startsWith('Easy and long runs:')))
    ) {
      easyPaces.push(secondsPerKm(activity))
    }
  }
  if (equivalents.length < 3) return null

  const ranges: PaceEstimates['ranges'] = {}
  if (easyPaces.length >= 3) {
    ranges.easy = range(Math.min(...easyPaces), Math.max(...easyPaces))
  }

  // Use the median of the three fastest Riegel equivalents (k=1.07).
  // Each activity contributes at most one training sample.
  // https://doi.org/10.1186/s13102-016-0052-y
  const tenKm = equivalents.sort((a, b) => a - b)[1]!
  const hourDistance = 10 * (3600 / (tenKm * 10)) ** (1 / 1.07)
  const tempo = Math.max(tenKm, 3600 / hourDistance)
  const half = tenKm * (21.0975 / 10) ** 0.07
  // ±10 seconds is a display allowance, not a statistical confidence interval.
  ranges.tenKm = range(tenKm - 10, tenKm + 10)
  ranges.tempo = range(tempo - 10, tempo + 10)
  ranges.half = range(half - 10, half + 10)
  return { ranges, runCount: equivalents.length, lapRunCount, latestDate }
}
