export type Status = 'pending' | 'completed' | 'skipped'
export interface Session {
  id: string
  date: string
  kind: 'Core' | 'Optional' | 'Race' | 'Extra'
  title: string
  instructions?: string[]
}
export interface Week {
  number: number
  start: string
  recovery: boolean
  sessions: Session[]
}
export interface Plan {
  version: number
  raceDate: string
  timezone: 'Asia/Tokyo'
  goal: string
  weeks: Week[]
  guidance: string[]
}
export interface Progress {
  status: Status
  note: string
  actualDate: string | null
}
export interface Activity {
  id: string
  type: string
  startedAt: string
  title: string
  distanceKm: number
  durationSeconds: number
  paceSeconds: number | null
  averageHr: number | null
  maxHr: number | null
  sessionId: string | null
  linkSource: 'name' | 'manual' | null
  raw: Record<string, string>
}
export interface TrainingState {
  schemaVersion: 1
  plan: Plan
  progress: Record<string, Progress>
  activities: Activity[]
}
export interface Snapshot {
  state: TrainingState
  revision: number
  updatedAt: string
}
export const blankProgress = (): Progress => ({ status: 'pending', note: '', actualDate: null })
export const sessionsOf = (state: TrainingState) =>
  state.plan.weeks.flatMap((week) => week.sessions)
export const tokyoToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
export function addDays(date: string, amount: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10)
}
export function weekDistance(state: TrainingState, week: Week): number {
  const end = addDays(week.start, 7)
  return state.activities
    .filter(
      (a) =>
        a.type.toLowerCase() === 'running' &&
        a.startedAt.slice(0, 10) >= week.start &&
        a.startedAt.slice(0, 10) < end,
    )
    .reduce((sum, a) => sum + a.distanceKm, 0)
}
export function runLabel(session: Session): string {
  if (session.kind === 'Race') return 'Race day'
  if (session.kind === 'Extra') return 'Extra optional run'
  if (session.kind === 'Optional') return 'Optional run'
  return session.id.endsWith('-a') ? 'Core run A' : 'Core run B'
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  )
}
export function assertState(value: unknown): asserts value is TrainingState {
  if (!value || typeof value !== 'object') throw new Error('Backup must contain a training plan.')
  const state = value as TrainingState
  if (
    state.schemaVersion !== 1 ||
    !state.plan ||
    !Array.isArray(state.plan.weeks) ||
    !state.plan.weeks.length ||
    state.plan.weeks.length > 100 ||
    state.plan.timezone !== 'Asia/Tokyo' ||
    !Number.isInteger(state.plan.version) ||
    !validDate(state.plan.raceDate) ||
    typeof state.plan.goal !== 'string' ||
    !Array.isArray(state.plan.guidance) ||
    !state.plan.guidance.every((s) => typeof s === 'string' && s.length < 4000) ||
    !state.progress ||
    typeof state.progress !== 'object' ||
    Array.isArray(state.progress) ||
    !Array.isArray(state.activities) ||
    state.activities.length > 20000
  ) {
    throw new Error('Unsupported or incomplete training backup.')
  }
  const ids = new Set<string>()
  const weeks = new Set<number>()
  let previousStart = ''
  for (const week of state.plan.weeks) {
    if (
      !Number.isInteger(week.number) ||
      week.number < 1 ||
      weeks.has(week.number) ||
      !validDate(week.start) ||
      week.start <= previousStart ||
      typeof week.recovery !== 'boolean' ||
      !Array.isArray(week.sessions) ||
      week.sessions.length > 20
    )
      throw new Error('Invalid training week.')
    weeks.add(week.number)
    previousStart = week.start
    for (const session of week.sessions) {
      if (
        !session ||
        typeof session.id !== 'string' ||
        !/^w\d+-(a|b|optional|race|extra-optional)$/.test(session.id) ||
        ids.has(session.id) ||
        !session.id.startsWith(`w${week.number}-`) ||
        !validDate(session.date) ||
        !['Core', 'Optional', 'Race', 'Extra'].includes(session.kind) ||
        typeof session.title !== 'string' ||
        !session.title ||
        session.title.length > 2000 ||
        (session.instructions !== undefined &&
          (!Array.isArray(session.instructions) ||
            !session.instructions.every((s) => typeof s === 'string' && s.length < 4000)))
      ) {
        throw new Error('Invalid or duplicate session.')
      }
      ids.add(session.id)
    }
  }
  for (const [id, progress] of Object.entries(state.progress)) {
    if (
      !ids.has(id) ||
      !progress ||
      !['pending', 'completed', 'skipped'].includes(progress.status) ||
      typeof progress.note !== 'string' ||
      progress.note.length > 4000 ||
      (progress.actualDate !== null && !validDate(progress.actualDate))
    )
      throw new Error('Invalid session progress.')
  }
  const activityIds = new Set<string>()
  for (const activity of state.activities) {
    if (
      !activity ||
      typeof activity.id !== 'string' ||
      activityIds.has(activity.id) ||
      typeof activity.type !== 'string' ||
      typeof activity.title !== 'string' ||
      activity.title.length > 2000 ||
      typeof activity.startedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(activity.startedAt) ||
      !validDate(activity.startedAt.slice(0, 10)) ||
      !Number.isFinite(Date.parse(activity.startedAt)) ||
      !Number.isFinite(activity.distanceKm) ||
      activity.distanceKm < 0 ||
      activity.distanceKm > 2000 ||
      !Number.isFinite(activity.durationSeconds) ||
      activity.durationSeconds < 0 ||
      ![activity.paceSeconds, activity.averageHr, activity.maxHr].every(
        (n) => n === null || (Number.isFinite(n) && n >= 0),
      ) ||
      (activity.sessionId !== null && !ids.has(activity.sessionId)) ||
      ![null, 'manual', 'name'].includes(activity.linkSource) ||
      !activity.raw ||
      typeof activity.raw !== 'object' ||
      Array.isArray(activity.raw) ||
      Object.entries(activity.raw).some(
        ([k, v]) => k.length > 200 || typeof v !== 'string' || v.length > 8000,
      )
    ) {
      throw new Error('Invalid or duplicate activity in backup.')
    }
    activityIds.add(activity.id)
  }
}
