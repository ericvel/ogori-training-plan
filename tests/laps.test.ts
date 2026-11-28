import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyCommand, importActivities } from '../shared/commands.ts'
import { assertState } from '../shared/model.ts'
import { isWorkLap, lapMismatch, parseGarminLaps, sameLapData } from '../shared/laps.ts'
import { estimatePaces } from '../src/lib/paceTargets.ts'
import { lapDuration } from '../src/lib/format.ts'
import { fixture, header, row } from './fixtures.ts'

// Invented exports mirror both Garmin header shapes; never commit personal activity exports.
export const ordinaryLaps = `Laps,Time,Cumulative Time,Distance,Avg Pace,Avg HR,Max HR,Calories,Avg Power
1,6:00.1,6:00,1.00,6:00,130,142,40,--
2,7:00,13:00,1.00,7:00,134,145,40,--
3,21:59.9,35:00,3.25,6:50,135,148,120,--
Summary,35:00,35:00,5.25,6:40,133,148,200,--`
export const workoutLaps = `,Interval,Step Type,Lap,Time,Distance,Avg Pace,Avg HR,Max HR,Cadence
,,Warm Up,1 - 2,9:00,1.50,6:00,125,135,160
,,Warm Up,1,6:00.1,1.00,6:00,124,130,160
,,,2,2:59.9,0.50,6:00,126,135,160
,1,Run,3,5:00,1.00,5:00,145,155,170
,,Recovery,4,2:00,0.25,8:00,130,140,160
,2,Run,5,5:00,1.00,5:00,148,158,170
,,Recovery,6,2:00,0.25,8:00,132,142,160
,,Cool Down,7 - 8,12:00,1.25,9:36,125,135,155
,,Cool Down,7,8:00,1.00,8:00,126,135,155
,,Cool Down,8,4:00,0.25,16:00,124,132,155
,Summary,--,--,35:00,5.24,6:41,134,158,163`
const initial = () => importActivities(fixture(), `${header}\n${row}`).state

test('lap duration display preserves fractions across minute and hour boundaries', () => {
  assert.equal(lapDuration(59.96), '0:59.96')
  assert.equal(lapDuration(3599.999), '59:59.999')
  assert.equal(lapDuration(3600.125), '1:00:00.125')
  assert.equal(lapDuration(0.05), '0:00.05')
  assert.equal(lapDuration(60), '1:00')
})

test('flat exports retain core values, source pace and fractional time, not extra metrics', () => {
  const data = parseGarminLaps(`\uFEFF${ordinaryLaps.replaceAll('\n', '\r\n')}`)
  assert.equal(data.laps.length, 3)
  assert.equal(data.laps[0]?.durationSeconds, 360.1)
  assert.equal(data.laps[2]?.paceSeconds, 410)
  assert.equal(data.laps[0]?.stepType, null)
  assert.equal(data.laps.some(isWorkLap), false)
  assert.deepEqual(data.totals, { distanceKm: 5.25, durationSeconds: 2100 })
  assert.doesNotMatch(JSON.stringify(data), /Calories|Power|Cumulative|raw/)
})
test('workout groups supply labels but never duplicate laps, time or work intervals', () => {
  const data = parseGarminLaps(workoutLaps)
  assert.deepEqual(
    data.laps.map((lap) => lap.number),
    [1, 2, 3, 4, 5, 6, 7, 8],
  )
  assert.equal(data.laps[1]?.stepType, 'Warm Up')
  assert.deepEqual(
    data.laps.filter(isWorkLap).map((lap) => lap.interval),
    [1, 2],
  )
  assert.equal(
    data.laps.reduce((sum, lap) => sum + lap.durationSeconds, 0),
    2100,
  )
  assert.equal(data.totals.distanceKm, 5.24)
  assert.equal(lapMismatch(initial().activities[0]!, data), false)
  assert.doesNotMatch(JSON.stringify(data), /Cadence/)
  const noSummary = parseGarminLaps(workoutLaps.split('\n').slice(0, -1).join('\n'))
  assert.equal(noSummary.totals.distanceKm, 5.25)
  assert.equal(noSummary.totals.durationSeconds, 2100)
})
test('optional pace and HR may be absent, blank or --; required time and distance may not', () => {
  const data = parseGarminLaps('Laps,Time,Distance\n1,6:01.5,1')
  assert.equal(data.laps[0]?.paceSeconds, null)
  assert.equal(data.laps[0]?.averageHr, null)
  assert.equal(data.laps[0]?.maxHr, null)
  assert.equal(
    parseGarminLaps(ordinaryLaps.replace('6:00,130,142', '--,,--')).laps[0]?.averageHr,
    null,
  )
  assert.throws(() => parseGarminLaps('Laps,Time,Distance\n1,--,1'))
  assert.throws(() => parseGarminLaps('Laps,Time,Distance\n1,6:00,--'))
})
test('invalid rows and incomplete groups fail as a whole without partial activity changes', () => {
  const state = initial(),
    before = structuredClone(state)
  for (const csv of [
    'Activity Type,Date,Title,Distance,Time\nRunning,2026-10-20 08:12:34,Run,1,6:00',
    'Laps,Time,Time,Distance\n1,6:00,6:00,1',
    'Laps,Lap,Time,Distance\n1,1,6:00,1',
    'Laps,Time,Distance\nSummary,6:00,1',
    ordinaryLaps.replace('2,7:00', '1,7:00'),
    ordinaryLaps.replace('21:59.9', '21:99.9'),
    ordinaryLaps.replace('130,142', '301,142'),
    ordinaryLaps.replace('1.00,6:00', '-1.00,6:00'),
    `${ordinaryLaps}\nSummary,35:00,35:00,5.25,6:40,133,148,200,--`,
    workoutLaps.replace('1 - 2', '1 - 4'),
    `${ordinaryLaps}\nnot,a,lap`,
  ]) {
    assert.throws(() =>
      applyCommand(state, {
        type: 'activity.laps.import',
        id: state.activities[0]!.id,
        csv,
        acceptMismatch: true,
      }),
    )
    assert.deepEqual(state, before)
  }
})
test('mismatch checks tolerate rounding and apply both absolute and relative boundaries', () => {
  const data = parseGarminLaps(ordinaryLaps)
  const activity = { distanceKm: 5.25, durationSeconds: 2100 }
  assert.equal(lapMismatch(activity, data), false)
  assert.equal(
    lapMismatch(activity, { ...data, totals: { distanceKm: 5.35, durationSeconds: 2121 } }),
    false,
  )
  assert.equal(
    lapMismatch(activity, { ...data, totals: { distanceKm: 5.351, durationSeconds: 2100 } }),
    true,
  )
  assert.equal(
    lapMismatch(activity, { ...data, totals: { distanceKm: 5.25, durationSeconds: 2121.1 } }),
    true,
  )
  assert.equal(
    lapMismatch(
      { distanceKm: 20, durationSeconds: 100 },
      { ...data, totals: { distanceKm: 20.2, durationSeconds: 105 } },
    ),
    false,
  )
})
test('imports replace, dedupe and remove only laps; overview refresh and backups preserve them', () => {
  const state = initial(),
    id = state.activities[0]!.id
  const saved = applyCommand(state, {
    type: 'activity.laps.import',
    id,
    csv: ordinaryLaps,
    acceptMismatch: false,
  })
  assert.equal(state.activities[0]?.lapData, undefined)
  assert.deepEqual(saved.activities[0], {
    ...state.activities[0],
    lapData: parseGarminLaps(ordinaryLaps),
  })
  assert.deepEqual(
    applyCommand(saved, {
      type: 'activity.laps.import',
      id,
      csv: ordinaryLaps,
      acceptMismatch: false,
    }),
    saved,
  )
  const replacement = applyCommand(saved, {
    type: 'activity.laps.import',
    id,
    csv: workoutLaps,
    acceptMismatch: false,
  })
  assert.equal(replacement.activities[0]?.lapData?.laps.length, 8)
  const overview = importActivities(
    replacement,
    `${header}\n${row.replace('week1coreA', 'Renamed run')}`,
  ).state
  assert.deepEqual(overview.activities[0]?.lapData, replacement.activities[0]?.lapData)
  const restored = applyCommand(fixture(), {
    type: 'backup.restore',
    state: JSON.parse(JSON.stringify(overview)),
  })
  assert.deepEqual(restored, overview)
  assertState(state) // Older backups without laps remain valid.
  const removed = applyCommand(restored, { type: 'activity.laps.remove', id })
  assert.equal(removed.activities[0]?.lapData, undefined)
  assert.equal(removed.activities[0]?.distanceKm, 5.25)
  assert.deepEqual(removed.progress, state.progress)
})

test('saving, replacing and removing sustained work laps updates faster pace ranges', () => {
  const state = initial()
  const run = state.activities[0]!
  const tempo = { ...run, sessionId: 'w3-a' }
  state.activities = [
    ...[1920, 2400, 2520].map((durationSeconds, index) => ({
      ...run,
      id: `steady-${index}`,
      distanceKm: 6,
      durationSeconds,
    })),
    { ...tempo, distanceKm: 6, durationSeconds: 2400 },
  ]
  const csv = `Interval,Step Type,Lap,Time,Distance,Avg Pace
,Warm Up,1,10:00,1.25,8:00
1,Run,2,6:00,1.20,4:30
1,Run,3,1:30,0.30,4:30
,Recovery,4,2:00,0.25,8:00
2,Run,5,9:00,1.50,5:30
3,Run,6,0:20,0.10,3:20
,Cool Down,7,11:10,1.40,8:00`
  const estimate = (state: ReturnType<typeof initial>) =>
    estimatePaces(state.plan, state.activities)
  const before = estimate(state)
  const importCommand = {
    type: 'activity.laps.import' as const,
    id: tempo.id,
    csv,
    acceptMismatch: false,
  }
  const saved = applyCommand(state, importCommand)
  const after = estimate(saved)
  assert.equal(after?.runCount, 4)
  assert.equal(after?.lapRunCount, 1)
  assert.equal(after?.ranges.easy, before?.ranges.easy)
  assert.equal(after?.ranges.tenKm, '5:45–6:10')
  assert.notEqual(after?.ranges.tempo, before?.ranges.tempo)
  assert.notEqual(after?.ranges.half, before?.ranges.half)

  const groupedCsv = `Interval,Step Type,Lap,Time,Distance,Avg Pace
,Warm Up,1,10:00,1.25,8:00
1,Run,2 - 3,7:30,1.50,5:00
,,2,6:00,1.20,5:00
,,3,1:30,0.30,5:00
,Rest,4,2:00,0.25,8:00
2,Run,5 - 6,9:00,1.50,6:00
,,5,8:10,1.35,6:03
,,6,0:50,0.15,5:33
,Cool Down,7,11:28,1.50,7:39
3,Run,8,0:02,0,14:16`
  const grouped = applyCommand(saved, { ...importCommand, csv: groupedCsv })
  const work = grouped.activities.at(-1)?.lapData?.laps.filter(isWorkLap)
  assert.deepEqual(
    work?.map((lap) => [lap.number, lap.interval]),
    [
      [2, null],
      [3, null],
      [5, null],
      [6, null],
    ],
  )
  assert.deepEqual(estimate(grouped), after)

  const flatCsv = csv
    .split('\n')
    .map((row) => row.split(',').slice(2).join(','))
    .join('\n')
  const replaced = applyCommand(saved, { ...importCommand, csv: flatCsv })
  assert.deepEqual(estimate(replaced), before)
  const removed = applyCommand(saved, { type: 'activity.laps.remove', id: tempo.id })
  assert.deepEqual(estimate(removed), before)

  // A file with several intervals still represents one training run.
  assert.equal(estimatePaces(saved.plan, saved.activities.slice(-2)), null)
  assert.equal(estimatePaces(saved.plan, saved.activities.slice(-3))?.runCount, 3)

  const shorter = applyCommand(
    { ...state, activities: [...state.activities.slice(0, 3), tempo] },
    {
      ...importCommand,
      csv: workoutLaps,
    },
  )
  assert.equal(estimate(shorter)?.lapRunCount, 1)
})

test('mismatched files require explicit confirmation on server; wrong targets are rejected', () => {
  const state = initial(),
    id = state.activities[0]!.id
  const csv = ordinaryLaps.replace('Summary,35:00,35:00,5.25', 'Summary,40:00,40:00,7.00')
  assert.throws(
    () => applyCommand(state, { type: 'activity.laps.import', id, csv, acceptMismatch: false }),
    /confirm the mismatch/,
  )
  const saved = applyCommand(state, { type: 'activity.laps.import', id, csv, acceptMismatch: true })
  assert.equal(saved.activities[0]?.lapData?.totals.distanceKm, 7)
  assert.equal(saved.activities[0]?.distanceKm, 5.25)
  assert.throws(
    () =>
      applyCommand(state, {
        type: 'activity.laps.import',
        id: 'missing',
        csv: ordinaryLaps,
        acceptMismatch: true,
      }),
    /not found/,
  )
  state.activities[0]!.type = 'Cycling'
  assert.throws(
    () =>
      applyCommand(state, {
        type: 'activity.laps.import',
        id,
        csv: ordinaryLaps,
        acceptMismatch: true,
      }),
    /running/,
  )
})
test('backup lap validation rejects duplicates, invalid metrics and untracked extra fields', () => {
  const state = initial()
  state.activities[0]!.lapData = parseGarminLaps(ordinaryLaps)
  const valid = structuredClone(state)
  state.activities[0]!.lapData.laps[1]!.number = 1
  assert.throws(() => assertState(state), /lap/)
  const unknown = JSON.parse(JSON.stringify(valid))
  unknown.activities[0].lapData.laps[0].calories = 500
  assert.throws(() => assertState(unknown), /lap/)
  const broken = structuredClone(valid)
  broken.activities[0]!.lapData!.laps[0]!.durationSeconds = Infinity
  assert.throws(() => assertState(broken), /lap/)
  const reordered = JSON.parse(JSON.stringify(valid.activities[0]!.lapData))
  reordered.laps[0] = Object.fromEntries(Object.entries(reordered.laps[0]).reverse())
  assert.equal(sameLapData(valid.activities[0]!.lapData, reordered), true)
})
