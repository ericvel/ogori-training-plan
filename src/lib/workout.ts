import type { Session } from '../../shared/model.ts'
import type { PaceEstimates, PaceKind } from './paceTargets.ts'

// Presentation only: keep the saved plan and any custom coaching instructions intact.
const legacy = {
  easy: 'Easy and long runs: full-sentence conversation, about 3–4/10 effort.',
  tempo:
    'Tempo: comfortably hard, about 6–7/10 effort. 10 km repetitions: controlled 7–8/10 effort. Set these by current fitness.',
  intervals: '10 km repetitions: controlled 7–8/10 effort. Set these by current fitness.',
  half: 'Half-marathon work: use controlled current half-marathon effort. Work toward 4:28–4:30/km only when fitness supports it.',
  warmup:
    'For tempo, intervals, race-pace work and the 10 km benchmark, add 10–15 minutes easy before and 10 minutes easy afterward. Listed repetitions exclude this.',
  schedule:
    'Keep at least one non-running day between runs. Do not add skipped optional mileage to core runs.',
  tempoRecovery: 'Jog 2 minutes between tempo repetitions.',
  halfRecovery: 'Jog 3 minutes between half-marathon repetitions.',
  intervalRecovery: 'Jog 90 seconds between 1 km repetitions.',
  strides:
    'Strides: 20 seconds of smooth, quick running, without sprinting. Walk or jog 60–90 seconds between strides. Resume only after the knee has tolerated several easy runs.',
}

export interface WorkoutTarget {
  label: string
  value: string
  note?: string
}

// Use the workout title, not shared coaching text that also accompanies easy runs.
export function benefitsFromLaps(session: Session): boolean {
  const title = session.title.replace(/\b(?:no|without)\s+strides\b/gi, '')
  return (
    session.kind === 'Race' ||
    /\b(?:tempo|threshold|intervals?|repetitions?|reps?|fartlek|progression|benchmark|time[- ]trial|race[- ]pace|hills?|strides)\b/i.test(
      title,
    ) ||
    /\b(?:hm|half[- ]marathon)\s+(?:pace|effort)\b/i.test(title) ||
    /\b(?:[2-9]|[1-9]\d+)\s*[×x]\s*\d/i.test(title)
  )
}

export function workoutSummary(
  session: Session,
  raceGoal?: string,
  estimates?: PaceEstimates | null,
) {
  const instructions = [
    ...new Set(
      (session.instructions ?? []).map((instruction) =>
        // Recognize the original anecdotal example without embedding personal run data.
        /^Easy and long runs: full-sentence conversation, about 3–4\/10 effort\. There is no pace minimum; .+ is fine when it matches easy effort\.$/.test(
          instruction,
        )
          ? legacy.easy
          : instruction,
      ),
    ),
  ]
  const has = (instruction: string) => instructions.includes(instruction)
  const tempo = /\btempo\b/i.test(session.title)
  const half = /half[- ]marathon/i.test(session.title)
  const intervals = /\b1\s*km\b/i.test(session.title)
  const repetitions = /\b(?:[2-9]|[1-9]\d+)\s*[×x]\s*\d/i.test(session.title)
  let target: WorkoutTarget | null = null
  let paceKind: PaceKind | null = null

  if (session.kind === 'Race' && raceGoal) {
    paceKind = 'half'
    target = { label: 'Race goal', value: raceGoal }
  } else if (tempo && has(legacy.tempo)) {
    paceKind = 'tempo'
    target = {
      label: 'Target effort',
      value: '6–7/10 · comfortably hard',
      note: 'By current fitness',
    }
  } else if (half && has(legacy.half)) {
    paceKind = 'half'
    target = {
      label: 'Target effort',
      value: 'Current half-marathon effort',
      note: '4:28–4:30/km only when fitness supports it',
    }
  } else if (intervals && has(legacy.intervals)) {
    paceKind = 'tenKm'
    target = { label: 'Target effort', value: '7–8/10 · controlled', note: 'By current fitness' }
  } else if (has(legacy.easy)) {
    paceKind = 'easy'
    target = {
      label: 'Target effort',
      value: 'Easy · 3–4/10',
      note: 'Conversational · no pace minimum',
    }
  }
  if (!paceKind && /10\s*km.*(?:race|time trial|benchmark)/i.test(session.title)) paceKind = 'tenKm'
  const estimatedRange = paceKind && estimates?.ranges[paceKind]
  if (estimatedRange) {
    const effort = target?.value
    target = {
      label: 'Est. pace',
      value: `${estimatedRange} /km`,
      note: session.kind === 'Race' ? `Current fitness · goal ${raceGoal}` : effort,
    }
  }

  const steps: { label: string; value: string }[] = []
  if (has(legacy.warmup)) steps.push({ label: 'Warm-up', value: '10–15 min easy' })
  const details: string[] = []
  for (const instruction of instructions) {
    switch (instruction) {
      case legacy.schedule:
      case legacy.warmup:
        break
      case legacy.easy:
        if (paceKind !== 'easy') details.push(instruction)
        else if (estimatedRange)
          details.push(
            'Keep a full-sentence conversation. Slower is fine; there is no pace minimum.',
          )
        break
      case legacy.tempo:
        if (!tempo || !target) details.push(instruction)
        break
      case legacy.intervals:
        if (!intervals || !target) details.push(instruction)
        break
      case legacy.half:
        if (!half || !target) details.push(instruction)
        else if (estimatedRange)
          details.push('Work toward 4:28–4:30/km only when fitness supports it.')
        break
      case legacy.tempoRecovery:
        if (tempo && repetitions) steps.push({ label: 'Recovery', value: '2 min jog between reps' })
        break
      case legacy.halfRecovery:
        if (half && repetitions) steps.push({ label: 'Recovery', value: '3 min jog between reps' })
        break
      case legacy.intervalRecovery:
        if (intervals && repetitions)
          steps.push({ label: 'Recovery', value: '90 sec jog between reps' })
        break
      case legacy.strides:
        if (!/\bno strides\b/i.test(session.title)) {
          steps.push({
            label: 'Strides',
            value: '20 sec smooth and quick; walk/jog 60–90 sec between',
          })
          details.push(
            'Do not sprint. Resume strides only after the knee has tolerated several easy runs.',
          )
        }
        break
      default:
        if (instruction.trim() && instruction.trim() !== session.title.trim())
          details.push(instruction)
    }
  }
  if (has(legacy.warmup)) steps.push({ label: 'Cool-down', value: '10 min easy' })
  return { target, steps, details }
}
