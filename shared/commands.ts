import { assertState, blankProgress, sessionsOf, validDate } from './model.ts'
import type { Activity, Progress, TrainingState } from './model.ts'
import { parseGarmin } from './csv.ts'

export type Command =
  | { type: 'session.patch'; id: string; patch: Partial<Progress> }
  | { type: 'activity.link'; id: string; sessionId: string | null }
  | { type: 'csv.import'; csv: string }
  | { type: 'backup.restore'; state: TrainingState }
export interface ImportSummary {
  added: number
  updated: number
  linked: number
  extras: number
  unlinked: number
}

function nameTarget(state: TrainingState, activity: Activity): string | null {
  if (activity.type.toLowerCase() !== 'running') return null
  const match = /^week(\d+)(corea|coreb|optional|race)$/i.exec(activity.title.trim())
  if (!match) return null
  const number = Number(match[1]),
    kind = match[2]!.toLowerCase()
  const week = state.plan.weeks.find((w) => w.number === number)
  if (!week) return null
  if (kind === 'race') return week.sessions.find((s) => s.kind === 'Race')?.id ?? null
  const suffix = kind === 'corea' ? 'a' : kind === 'coreb' ? 'b' : 'optional'
  const id = `w${number}-${suffix}`
  if (week.sessions.some((s) => s.id === id)) return id
  if (kind === 'optional') {
    // Preserve the plan's prescribed workouts; record this as an extra, not a new prescription.
    const extraId = `w${number}-extra-optional`
    if (!week.sessions.some((s) => s.id === extraId))
      week.sessions.push({
        id: extraId,
        date: week.start,
        kind: 'Extra',
        title: 'Additional easy run',
        instructions: ['Recorded from Garmin. This run was additional to the original plan.'],
      })
    return extraId
  }
  return null
}
function completeLinked(state: TrainingState, activity: Activity) {
  if (!activity.sessionId) return
  const previous = state.progress[activity.sessionId] ?? blankProgress()
  state.progress[activity.sessionId] = {
    ...previous,
    status: 'completed',
    actualDate: activity.startedAt.slice(0, 10),
  }
}
export function importActivities(
  current: TrainingState,
  csv: string,
): { state: TrainingState; summary: ImportSummary } {
  const state = structuredClone(current)
  const summary: ImportSummary = { added: 0, updated: 0, linked: 0, extras: 0, unlinked: 0 }
  const initialExtras = sessionsOf(state).filter((s) => s.kind === 'Extra').length
  const activities = new Map(state.activities.map((a) => [a.id, a]))
  const incomingIds = new Set<string>()
  for (const activity of parseGarmin(csv)) {
    if (incomingIds.has(activity.id))
      throw new Error(
        'CSV contains two activities with the same type and start time. Resolve the duplicate before importing.',
      )
    incomingIds.add(activity.id)
    const previous = activities.get(activity.id)
    if (
      previous &&
      (previous.distanceKm !== activity.distanceKm ||
        previous.durationSeconds !== activity.durationSeconds)
    ) {
      throw new Error(
        `Activity at ${activity.startedAt.slice(0, 19).replace('T', ' ')} has different distance or duration. Existing record was preserved; resolve the conflicting export before importing.`,
      )
    }
    const target = nameTarget(state, activity)
    if (previous?.linkSource === 'manual') {
      activity.sessionId = previous.sessionId
      activity.linkSource = 'manual'
    } else {
      activity.sessionId = target
      activity.linkSource = target ? 'name' : null
    }
    if (
      activity.sessionId &&
      activity.linkSource === 'name' &&
      [...activities.values()].some(
        (a) => a.id !== activity.id && a.sessionId === activity.sessionId,
      )
    ) {
      throw new Error(
        `More than one activity claims ${activity.title}. Rename the conflicting activity in Garmin or link it manually.`,
      )
    }
    if (activity.sessionId) {
      summary.linked++
      completeLinked(state, activity)
    } else summary.unlinked++
    if (previous) summary.updated++
    else summary.added++
    activities.set(activity.id, activity)
  }
  state.activities = [...activities.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  summary.extras = sessionsOf(state).filter((s) => s.kind === 'Extra').length - initialExtras
  assertState(state)
  return { state, summary }
}
export function applyCommand(current: TrainingState, command: Command): TrainingState {
  if (!command || typeof command !== 'object') throw new Error('Missing update.')
  if (command.type === 'csv.import') {
    if (typeof command.csv !== 'string') throw new Error('Choose a CSV file.')
    return importActivities(current, command.csv).state
  }
  if (command.type === 'backup.restore') {
    assertState(command.state)
    return structuredClone(command.state)
  }
  const state = structuredClone(current)
  if (command.type === 'session.patch') {
    if (!sessionsOf(state).some((s) => s.id === command.id)) throw new Error('Session not found.')
    const patch = command.patch
    if (
      !patch ||
      typeof patch !== 'object' ||
      Object.keys(patch).some((k) => !['status', 'note', 'actualDate'].includes(k)) ||
      (patch.status !== undefined && !['pending', 'completed', 'skipped'].includes(patch.status)) ||
      (patch.note !== undefined && (typeof patch.note !== 'string' || patch.note.length > 4000)) ||
      (patch.actualDate !== undefined && patch.actualDate !== null && !validDate(patch.actualDate))
    ) {
      throw new Error('Invalid session update.')
    }
    state.progress[command.id] = { ...(state.progress[command.id] ?? blankProgress()), ...patch }
  } else if (command.type === 'activity.link') {
    const activity = state.activities.find((a) => a.id === command.id)
    if (!activity) throw new Error('Activity not found.')
    if (command.sessionId !== null && !sessionsOf(state).some((s) => s.id === command.sessionId))
      throw new Error('Session not found.')
    activity.sessionId = command.sessionId
    // A manual unlink must also survive future imports.
    activity.linkSource = 'manual'
    completeLinked(state, activity)
  } else throw new Error('Unknown update type.')
  assertState(state)
  return state
}
