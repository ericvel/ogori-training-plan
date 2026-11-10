import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { parseArgs } from 'node:util'
import { assertState, blankProgress } from '../shared/model.ts'
import type { Plan, TrainingState } from '../shared/model.ts'
import { importActivities } from '../shared/commands.ts'

const { values } = parseArgs({
  options: { 'source-dir': { type: 'string' }, csv: { type: 'string' } },
})
if (!values['source-dir'] || !values.csv) {
  throw new Error(
    'Usage: node scripts/prepare-migration.ts --source-dir /path/to/local-tracker --csv /path/to/overview.csv',
  )
}
const directory = resolve(values['source-dir'])
const schedule = JSON.parse(await readFile(join(directory, 'schedule.json'), 'utf8'))
const legacy = JSON.parse(await readFile(join(directory, 'progress.json'), 'utf8'))
if (
  schedule.version !== 2 ||
  !Array.isArray(schedule.weeks) ||
  legacy.schemaVersion !== 1 ||
  !legacy.done ||
  !legacy.notes
) {
  throw new Error('Unexpected legacy schedule or progress format. Original files were not changed.')
}
const html = await readFile(join(directory, 'index.html'), 'utf8')
const guidanceBlock = html.match(/<summary>How to use the plan[^]*?<ul>([^]*?)<\/ul>/)?.[1]
if (!guidanceBlock) throw new Error('Could not locate existing training guidance.')
const guidance = [...guidanceBlock.matchAll(/<li>([^]*?)<\/li>/g)].map((m) =>
  m[1]!.replace(/<[^>]+>/g, ''),
)
const plan: Plan = { ...schedule, goal: 'Under 1:35', guidance }
for (const week of plan.weeks) {
  for (const session of week.sessions) {
    const quality =
      /tempo|effort|pace|time trial/.test(session.title) && !/easy/.test(session.title)
    const instructions: string[] = []
    if (quality) {
      instructions.push(guidance[4]!)
      if (/tempo/.test(session.title))
        instructions.push(guidance[2]!, 'Jog 2 minutes between tempo repetitions.')
      else if (/half-marathon/.test(session.title))
        instructions.push(guidance[3]!, 'Jog 3 minutes between half-marathon repetitions.')
      else if (/1 km/.test(session.title))
        instructions.push(
          '10 km repetitions: controlled 7–8/10 effort. Set these by current fitness.',
          'Jog 90 seconds between 1 km repetitions.',
        )
    } else if (session.kind !== 'Race') instructions.push(guidance[1]!)
    if (/strides/.test(session.title) && !/no strides/.test(session.title))
      instructions.push(guidance[6]!)
    if (session.kind !== 'Race')
      instructions.push(
        'Keep at least one non-running day between runs. Do not add skipped optional mileage to core runs.',
      )
    session.instructions = instructions
  }
}
const progress: TrainingState['progress'] = {}
const ids = new Set(plan.weeks.flatMap((w) => w.sessions.map((s) => s.id)))
for (const id of new Set([...Object.keys(legacy.done), ...Object.keys(legacy.notes)])) {
  if (!ids.has(id))
    throw new Error(`Legacy progress has an unknown session: ${id}. Resolve before migrating.`)
  progress[id] = {
    ...blankProgress(),
    status: legacy.done[id] ? 'completed' : 'pending',
    note: legacy.notes[id] ?? '',
  }
}
const initial: TrainingState = { schemaVersion: 1, plan, progress, activities: [] }
assertState(initial)
const { state, summary } = importActivities(initial, await readFile(resolve(values.csv), 'utf8'))
const privateDir = resolve('.private')
await mkdir(privateDir, { recursive: true, mode: 0o700 })
await writeFile(join(privateDir, 'initial-state.json'), JSON.stringify(state, null, 2), {
  mode: 0o600,
})
const literal = JSON.stringify(state).replaceAll("'", "''")
await writeFile(
  join(privateDir, 'seed.sql'),
  `INSERT INTO app_state (id, document, revision, updated_at) VALUES (1, '${literal}', 0, '${new Date().toISOString()}') ON CONFLICT(id) DO NOTHING;\n`,
  { mode: 0o600 },
)
console.log(
  JSON.stringify(
    {
      migrated: true,
      weeks: state.plan.weeks.length,
      plannedSessions: state.plan.weeks.flatMap((w) => w.sessions).filter((s) => s.kind !== 'Extra')
        .length,
      preservedLegacyCompletions: Object.values(legacy.done).filter(Boolean).length,
      activities: state.activities.length,
      import: summary,
      output:
        '.private/initial-state.json and .private/seed.sql (ignored by Git; seed never overwrites existing data)',
    },
    null,
    2,
  ),
)
