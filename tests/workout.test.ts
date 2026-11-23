import assert from 'node:assert/strict'
import test from 'node:test'
import type { Activity, Session } from '../shared/model.ts'
import { estimatePaces } from '../src/lib/paceTargets.ts'
import { benefitsFromLaps, workoutSummary } from '../src/lib/workout.ts'
import { fixture } from './fixtures.ts'

const warmup =
  'For tempo, intervals, race-pace work and the 10 km benchmark, add 10–15 minutes easy before and 10 minutes easy afterward. Listed repetitions exclude this.'
const tempo =
  'Tempo: comfortably hard, about 6–7/10 effort. 10 km repetitions: controlled 7–8/10 effort. Set these by current fitness.'
const recovery = 'Jog 2 minutes between tempo repetitions.'
const easy =
  'Easy and long runs: full-sentence conversation, about 3–4/10 effort. There is no pace minimum; Tuesday’s 8:10/km is fine when it matches easy effort.'
const schedule =
  'Keep at least one non-running day between runs. Do not add skipped optional mileage to core runs.'
const session = (title: string, instructions: string[] = []): Session => ({
  id: 'w1-a',
  date: '2026-10-23',
  kind: 'Core',
  title,
  instructions,
})

test('tempo details retain execution steps without unrelated coaching or scheduling advice', () => {
  const workout = workoutSummary(session('2 × 10 min tempo', [warmup, tempo, recovery, schedule]))
  assert.equal(workout.target?.value, '6–7/10 · comfortably hard')
  assert.deepEqual(workout.steps, [
    { label: 'Warm-up', value: '10–15 min easy' },
    { label: 'Recovery', value: '2 min jog between reps' },
    { label: 'Cool-down', value: '10 min easy' },
  ])
  assert.deepEqual(workout.details, [])
})

test('continuous tempo has no between-rep recovery', () => {
  const workout = workoutSummary(session('20 min continuous tempo', [warmup, tempo, recovery]))
  assert.deepEqual(
    workout.steps.map((step) => step.label),
    ['Warm-up', 'Cool-down'],
  )
})

test('lap shortcuts cover structured and pace workouts without labeling ordinary easy runs', () => {
  for (const title of [
    '20 min tempo',
    '6 × 1 km',
    'Hill repeats',
    '8 km at HM effort',
    'Progression run',
    '10 km benchmark',
    'Easy + strides',
    'Fartlek intervals',
  ]) {
    assert.equal(benefitsFromLaps(session(title)), true, title)
  }
  for (const title of ['9 km easy', 'Long run', 'Easy, no strides', 'Recovery without strides']) {
    assert.equal(benefitsFromLaps(session(title, [warmup, tempo])), false, title)
  }
  assert.equal(benefitsFromLaps({ ...session('Ogori Half Marathon'), kind: 'Race' }), true)
})

test('custom coaching and cautions survive; duplicate title and instructions disappear', () => {
  const custom = 'Stop if discomfort returns. Keep this session shorter on hills.'
  const workout = workoutSummary(session('Custom workout', ['Custom workout', custom, custom]))
  assert.deepEqual(workout.details, [custom])
  assert.equal(workout.target, null)
  assert.deepEqual(workoutSummary(session('Race')).details, [])
})

test('easy effort never mistakes an anecdotal pace for a prescription', () => {
  const workout = workoutSummary(session('9 km', [easy, schedule]))
  assert.equal(workout.target?.value, 'Easy · 3–4/10')
  assert.equal(workout.target?.note, 'Conversational · no pace minimum')
  assert.deepEqual(workout.details, [])
})

function activity(id: number, overrides: Partial<Activity> = {}): Activity {
  return {
    id: `run-${id}`,
    type: 'Running',
    startedAt: `2026-10-${String(20 + id).padStart(2, '0')}T08:00:00+09:00`,
    title: 'Easy run',
    distanceKm: 6,
    durationSeconds: 2400,
    paceSeconds: 400,
    averageHr: null,
    maxHr: null,
    sessionId: 'w1-a',
    linkSource: 'manual',
    raw: {},
    ...overrides,
  }
}

test('estimates require enough sustained running history', () => {
  const plan = fixture().plan
  assert.equal(estimatePaces(plan, []), null)
  assert.equal(estimatePaces(plan, [activity(1), activity(2)]), null)
  assert.equal(
    estimatePaces(plan, [activity(1), activity(2), activity(3, { type: 'Cycling' })]),
    null,
  )
})

test('easy range reflects observed runs and uses elapsed pace when CSV pace differs', () => {
  const plan = fixture().plan
  const paces = estimatePaces(plan, [
    activity(1, { durationSeconds: 2280, paceSeconds: 300 }),
    activity(2),
    activity(3, { durationSeconds: 2640 }),
  ])
  assert.equal(paces?.ranges.easy, '6:20–7:20')
  assert.equal(paces?.runCount, 3)
  assert.equal(paces?.latestDate, '2026-10-23')
})

test('mixed workouts, old runs, and short bursts cannot make estimates faster', () => {
  const plan = fixture().plan
  const steady = [activity(1), activity(2), activity(3)]
  const before = estimatePaces(plan, steady)
  const after = estimatePaces(plan, [
    ...steady,
    activity(4, { sessionId: 'w3-a', durationSeconds: 1200 }),
    activity(5, { startedAt: '2026-07-01T08:00:00+09:00', durationSeconds: 1200 }),
    activity(6, { distanceKm: 1, durationSeconds: 180 }),
  ])
  assert.deepEqual(after?.ranges, before?.ranges)
  assert.equal(after?.runCount, 3)
})

test('one fast recording cannot set the faster-work reference by itself', () => {
  const plan = fixture().plan
  const runs = [activity(1), activity(2), activity(3)]
  const before = estimatePaces(plan, runs)
  const after = estimatePaces(plan, [
    ...runs,
    activity(4, { sessionId: null, durationSeconds: 1200 }),
  ])
  assert.equal(after?.ranges.tenKm, before?.ranges.tenKm)
  assert.equal(after?.ranges.tempo, before?.ranges.tempo)
  assert.equal(after?.ranges.half, before?.ranges.half)
})

test('unknown easy-run cautions stay intact when the original coaching is customized', () => {
  const custom = `${easy} Stop early if discomfort returns.`
  assert.deepEqual(workoutSummary(session('9 km', [custom])).details, [custom])
})

test('numeric estimates stay visible alongside effort and preserve the conditional HM goal', () => {
  const estimates = {
    ranges: { easy: '6:20–7:20', tempo: '5:30–5:55', half: '5:45–6:10' },
    runCount: 8,
    latestDate: '2026-10-23',
  }
  const workout = workoutSummary(session('3 × 5 min tempo', [tempo]), undefined, estimates)
  assert.equal(workout.target?.value, '5:30–5:55 /km')
  assert.equal(workout.target?.note, '6–7/10 · comfortably hard')
  const half = workoutSummary(
    session('3 × 2 km at half-marathon effort', [
      'Half-marathon work: use controlled current half-marathon effort. Work toward 4:28–4:30/km only when fitness supports it.',
    ]),
    undefined,
    estimates,
  )
  assert.equal(half.target?.value, '5:45–6:10 /km')
  assert.deepEqual(half.details, ['Work toward 4:28–4:30/km only when fitness supports it.'])
  const easyWorkout = workoutSummary(session('9 km', [easy]), undefined, estimates)
  assert.match(easyWorkout.details[0]!, /Slower is fine/)
})
