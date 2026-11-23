import type { Activity, Plan } from '../../shared/model.ts'
import { addDays } from '../../shared/model.ts'
import { pace } from './format.ts'

export type PaceKind = 'easy' | 'tempo' | 'tenKm' | 'half'
export interface PaceEstimates {
  ranges: Partial<Record<PaceKind, string>>
  runCount: number
  latestDate: string
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}
const range = (fast: number, slow: number) =>
  `${pace(Math.floor(fast / 5) * 5)}–${pace(Math.ceil(slow / 5) * 5)}`

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
  // Whole-workout averages include warm-ups/recoveries: never treat them as work-rep paces.
  const continuous = recent.filter((a) => {
    const session = a.sessionId ? sessions.get(a.sessionId) : undefined
    return !/tempo|[×x]\s*\d|strides|interval|pace\/effort|half-marathon effort/i.test(
      session?.title ?? a.title,
    )
  })
  const secondsPerKm = (a: Activity) => a.durationSeconds / a.distanceKm
  const valid = continuous.filter((a) => {
    const value = secondsPerKm(a)
    return Number.isFinite(value) && value >= 150 && value <= 900
  })
  if (valid.length < 3) return null

  const easy = valid.filter((a) => {
    const session = a.sessionId ? sessions.get(a.sessionId) : undefined
    return (
      session &&
      session.kind !== 'Race' &&
      (/\b(?:easy|long run)\b/i.test(session.title) ||
        session.instructions?.some((instruction) => instruction.startsWith('Easy and long runs:')))
    )
  })
  const ranges: PaceEstimates['ranges'] = {}
  if (easy.length >= 3) {
    const paces = easy.map(secondsPerKm)
    ranges.easy = range(Math.min(...paces), Math.max(...paces))
  }

  // Riegel distance scaling (k=1.07), using three sustained runs so a single
  // unusually fast recording cannot set the reference pace on its own.
  // These are conservative training-run proxies, not measured race fitness.
  // https://doi.org/10.1186/s13102-016-0052-y
  const equivalents = valid
    .map((a) => secondsPerKm(a) * (10 / a.distanceKm) ** 0.07)
    .sort((a, b) => a - b)
  const tenKm = median(equivalents.slice(0, 3))
  const hourDistance = 10 * (3600 / (tenKm * 10)) ** (1 / 1.07)
  const tempo = Math.max(tenKm, 3600 / hourDistance)
  const half = tenKm * (21.0975 / 10) ** 0.07
  // ±10 seconds is a display allowance, not a statistical confidence interval.
  ranges.tenKm = range(tenKm - 10, tenKm + 10)
  ranges.tempo = range(tempo - 10, tempo + 10)
  ranges.half = range(half - 10, half + 10)
  return { ranges, runCount: valid.length, latestDate }
}
