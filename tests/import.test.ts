import { test } from 'node:test'
import assert from 'node:assert/strict'
import { metric, parseGarmin, readCsv, seconds } from '../shared/csv.ts'
import { applyCommand, importActivities } from '../shared/commands.ts'
import { assertState, weekDistance } from '../shared/model.ts'
import { csv, fixture, header, row } from './fixtures.ts'

test('Garmin quoting, BOM, multiline titles, decimal lap time, and escaped elevations', () => {
  const activities = parseGarmin(
    `\uFEFF${header}\r\n${row.replace('week1coreA', '"Easy, \"\"steady\"\"\nrun"')}\r\n`,
  )
  assert.equal(activities[0]?.title, 'Easy, "steady"\nrun')
  assert.equal(activities[0]?.raw.Steps, '5,000')
  assert.equal(activities[0]?.durationSeconds, 2100)
  assert.equal(activities[0]?.paceSeconds, 400)
  assert.equal(metric(activities[0]?.raw['Min Elevation']), -2)
  assert.equal(metric('--'), null)
  assert.equal(seconds('01:02:03.5'), 3723.5)
  assert.equal(seconds('02:53.9'), 173.9)
})
test('columns map by header, extra columns survive, and absent optional metrics stay null', () => {
  const [activity] = parseGarmin(
    'Title,Distance,Activity Type,Time,Date,Extra\nweek1coreA,3.2,Running,00:20:00,2026-10-20 10:00:00,retained',
  )
  assert.equal(activity?.distanceKm, 3.2)
  assert.equal(activity?.averageHr, null)
  assert.equal(activity?.raw.Extra, 'retained')
})
test('names link runs, create a stable extra optional slot, preserve legacy completion and notes', () => {
  const before = fixture(),
    original = structuredClone(before)
  const { state, summary } = importActivities(before, csv)
  assert.deepEqual(before, original)
  assert.deepEqual(summary, { added: 2, updated: 0, linked: 2, extras: 1, unlinked: 0 })
  assert.deepEqual(state.progress['w3-optional'], original.progress['w3-optional'])
  assert.equal(state.progress['w1-a']?.actualDate, '2026-10-20')
  assert.equal(
    state.activities.find((a) => a.title === 'week2optional')?.sessionId,
    'w2-extra-optional',
  )
  assert.equal(state.plan.weeks[1]?.sessions.length, 3)
  const again = importActivities(state, csv)
  assert.equal(again.state.activities.length, 2)
  assert.equal(again.state.plan.weeks[1]?.sessions.length, 3)
  assert.equal(again.summary.extras, 0)
})
test('renaming updates identity and links, manual choices survive future exports', () => {
  const initial = importActivities(fixture(), `${header}\n${row}`).state
  const renamed = `${header}\n${row.replace('week1coreA', 'week1coreB')}`
  const updated = importActivities(initial, renamed).state
  assert.equal(updated.activities.length, 1)
  assert.equal(updated.activities[0]?.sessionId, 'w1-b')
  const manual = applyCommand(updated, {
    type: 'activity.link',
    id: updated.activities[0]!.id,
    sessionId: null,
  })
  assert.equal(importActivities(manual, renamed).state.activities[0]?.sessionId, null)
  assert.equal(manual.progress['w1-a']?.status, 'completed')
})
test('imports retain omitted activities and dedupe conflicts are atomic', () => {
  const initial = importActivities(fixture(), csv).state
  assert.equal(importActivities(initial, `${header}\n${row}`).state.activities.length, 2)
  const original = structuredClone(initial)
  assert.throws(
    () => importActivities(initial, `${header}\n${row.replace('5.25', '7.07')}`),
    /different distance/,
  )
  assert.deepEqual(initial, original)
  assert.throws(
    () => importActivities(initial, `${header}\n${row}\n${row}`),
    /same type and start time/,
  )
})
test('two distinct activities claiming one session require explicit resolution', () => {
  assert.throws(
    () =>
      importActivities(fixture(), `${header}\n${row}\n${row.replace('2026-10-20', '2026-10-22')}`),
    /More than one activity/,
  )
})
test('weekly totals follow actual Japan dates instead of title week; races can match by name', () => {
  const text = `${header}\n${row.replace('week1coreA', 'week2coreA')}\n${row.replace('2026-10-20 08:12:34', '2026-11-08 09:00:00').replace('week1coreA', 'week3race')}`
  const state = importActivities(fixture(), text).state
  assert.equal(weekDistance(state, state.plan.weeks[0]!), 5.25)
  assert.equal(weekDistance(state, state.plan.weeks[1]!), 0)
  assert.equal(state.progress['w2-a']?.actualDate, '2026-10-20')
  assert.equal(state.activities.find((a) => a.title === 'week3race')?.sessionId, 'w3-b')
})
test('malformed rows, dates, times and per-lap files are rejected without partial imports', () => {
  assert.throws(() => readCsv('a,b\n"unfinished'), /unfinished/)
  assert.throws(() => readCsv('a,b\n"done"oops,x'), /Unexpected/)
  assert.throws(() => parseGarmin('Interval,Time,Distance\n1,6:00,1'), /activity-overview/)
  for (const invalid of [
    row.replace('2026-10-20', '2026-02-30'),
    row.replace('08:12:34', '25:36:38'),
    row.replace('00:35:00', '00:99:51'),
    row.replace('5.25', '--'),
    `${row},extra`,
  ]) {
    assert.throws(() => importActivities(fixture(), `${header}\n${row}\n${invalid}`))
  }
})
test('backup validation rejects broken links and unsupported schemas', () => {
  const state = importActivities(fixture(), csv).state
  assert.doesNotThrow(() => assertState(JSON.parse(JSON.stringify(state))))
  state.activities[0]!.sessionId = 'missing'
  assert.throws(() => assertState(state), /Invalid/)
  assert.throws(() => assertState({ schemaVersion: 2 }), /Unsupported/)
  assert.throws(
    () =>
      applyCommand(fixture(), {
        type: 'session.patch',
        id: 'w1-a',
        patch: { actualDate: '2026-02-30' },
      }),
    /Invalid/,
  )
})
