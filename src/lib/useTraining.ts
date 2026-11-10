import { computed, onMounted, onUnmounted, reactive, ref, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Progress, Snapshot } from '../../shared/model.ts'
import {
  addDays,
  assertState,
  runLabel,
  sessionsOf,
  tokyoToday,
  weekDistance,
} from '../../shared/model.ts'
import type { Command, ImportSummary } from '../../shared/commands.ts'
import { importActivities } from '../../shared/commands.ts'
import { ApiError, getSnapshot, saveCommand } from './client.ts'

export function useTraining() {
  const route = useRoute(),
    router = useRouter()
  const view = computed(() => String(route.name ?? 'week'))
  const snapshot = ref<Snapshot | null>(null),
    loading = ref(true),
    error = ref(''),
    busy = ref(0)
  const selected = ref(1),
    today = ref(tokyoToday()),
    search = ref(''),
    filter = ref('all')
  const drafts = reactive<Record<string, string>>({}),
    timers = new Map<string, ReturnType<typeof setTimeout>>()
  const fileInput = ref<HTMLInputElement | null>(null),
    restoreInput = ref<HTMLInputElement | null>(null)
  const csvPreview = ref<{ csv: string; name: string; summary: ImportSummary } | null>(null)
  const restorePreview = ref<{ name: string; state: Snapshot['state'] } | null>(null)
  const importError = ref(''),
    notice = ref('')
  let queue: Promise<unknown> = Promise.resolve(),
    retryCommand: Command | null = null,
    poll: ReturnType<typeof setInterval> | undefined
  const state = computed(() => snapshot.value?.state)
  const weeks = computed(() => state.value?.plan.weeks ?? [])
  const currentWeek = computed(
    () =>
      weeks.value.filter((w) => w.start <= today.value).at(-1)?.number ??
      weeks.value[0]?.number ??
      1,
  )
  const week = computed(() => weeks.value.find((w) => w.number === selected.value))
  const allSessions = computed(() => (state.value ? sessionsOf(state.value) : []))
  const planned = computed(() => allSessions.value.filter((s) => s.kind !== 'Extra'))
  const completed = computed(
    () => planned.value.filter((s) => state.value?.progress[s.id]?.status === 'completed').length,
  )
  const coreRuns = computed(() => allSessions.value.filter((s) => s.kind === 'Core'))
  const coreDone = computed(
    () => coreRuns.value.filter((s) => state.value?.progress[s.id]?.status === 'completed').length,
  )
  const daysToRace = computed(() =>
    state.value
      ? Math.round(
          (Date.parse(`${state.value.plan.raceDate}T00:00:00+09:00`) -
            Date.parse(`${today.value}T00:00:00+09:00`)) /
            86400000,
        )
      : 0,
  )
  const distance = computed(() =>
    state.value && week.value ? weekDistance(state.value, week.value) : 0,
  )
  const weeklyRuns = computed(() =>
    state.value && week.value
      ? state.value.activities.filter(
          (a) =>
            a.type.toLowerCase() === 'running' &&
            a.startedAt.slice(0, 10) >= week.value!.start &&
            a.startedAt.slice(0, 10) < addDays(week.value!.start, 7),
        ).length
      : 0,
  )
  const chartWeeks = computed(() =>
    weeks.value.slice(
      Math.max(0, selected.value - 5),
      Math.min(weeks.value.length, Math.max(6, selected.value + 1)),
    ),
  )
  const chartMax = computed(() =>
    Math.max(10, ...chartWeeks.value.map((w) => (state.value ? weekDistance(state.value, w) : 0))),
  )
  const chartDescription = computed(() =>
    chartWeeks.value
      .map(
        (w) =>
          `Week ${w.number}: ${state.value ? weekDistance(state.value, w).toFixed(2) : 0} kilometres`,
      )
      .join(', '),
  )
  const activities = computed(() =>
    (state.value?.activities ?? []).filter(
      (a) =>
        (filter.value !== 'unlinked' || !a.sessionId) &&
        `${a.title} ${a.startedAt}`.toLowerCase().includes(search.value.toLowerCase()),
    ),
  )
  const unsaved = computed(() => Object.keys(drafts).length > 0)
  const disabled = computed(() => busy.value > 0 || !!error.value)
  function linked(id: string) {
    return state.value?.activities.filter((a) => a.sessionId === id) ?? []
  }
  function sessionName(id: string | null) {
    const session = allSessions.value.find((s) => s.id === id)
    return session ? `Week ${/^w(\d+)/.exec(session.id)?.[1]} · ${runLabel(session)}` : 'Not linked'
  }
  function openWeek(number: number) {
    selected.value = number
    void router.push({ name: 'week' })
  }
  function navigate(id: string) {
    if (id === 'week') selected.value = currentWeek.value
    void router.push({ name: id })
  }
  async function load(initial = false) {
    if (!initial && (busy.value || unsaved.value || retryCommand)) return
    if (initial) loading.value = true
    try {
      snapshot.value = await getSnapshot()
      if (initial) selected.value = currentWeek.value
      error.value = ''
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not load your plan.'
    } finally {
      loading.value = false
    }
  }
  function mutate(command: Command): Promise<boolean> {
    busy.value++
    const operation = queue
      .then(async () => {
        if (!snapshot.value || (error.value && retryCommand)) return false
        try {
          snapshot.value = await saveCommand(snapshot.value.revision, command)
          error.value = ''
          retryCommand = null
          if (
            command.type === 'session.patch' &&
            command.patch.note !== undefined &&
            drafts[command.id] === command.patch.note
          )
            delete drafts[command.id]
          return true
        } catch (cause) {
          if (cause instanceof ApiError && cause.latest) snapshot.value = cause.latest
          error.value = cause instanceof Error ? cause.message : 'Could not save. Please retry.'
          retryCommand = command
          return false
        }
      })
      .finally(() => {
        busy.value--
      })
    queue = operation
    return operation
  }
  function patch(id: string, value: Partial<Progress>) {
    void mutate({ type: 'session.patch', id, patch: value })
  }
  function noteChanged(id: string, note: string) {
    drafts[id] = note
    clearTimeout(timers.get(id))
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        void mutate({ type: 'session.patch', id, patch: { note } })
      }, 600),
    )
  }
  async function retry() {
    const command = retryCommand
    try {
      snapshot.value = await getSnapshot()
      error.value = ''
      retryCommand = null
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not connect.'
      return
    }
    if (command) await mutate(command)
    for (const [id, note] of Object.entries(drafts)) {
      if (error.value) break
      await mutate({ type: 'session.patch', id, patch: { note } })
    }
  }
  async function chooseCsv(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0]
    if (!file || !state.value) return
    importError.value = ''
    notice.value = ''
    try {
      if (file.size > 2_000_000)
        throw new Error('CSV exceeds 2 MB. Export a smaller activity range.')
      const csv = await file.text(),
        result = importActivities(toRaw(state.value), csv)
      csvPreview.value = { csv, name: file.name, summary: result.summary }
      void router.push({ name: 'activities' })
    } catch (cause) {
      importError.value = cause instanceof Error ? cause.message : 'Could not read CSV.'
    }
    input.value = ''
  }
  async function confirmImport() {
    if (!csvPreview.value) return
    const summary = csvPreview.value.summary
    if (await mutate({ type: 'csv.import', csv: csvPreview.value.csv })) {
      notice.value = `${summary.added} new ${summary.added === 1 ? 'activity' : 'activities'} added. ${summary.updated} existing records refreshed.`
      csvPreview.value = null
    }
  }
  function downloadBackup() {
    if (!snapshot.value || unsaved.value || busy.value || error.value) return
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'ogori-training-backup',
            version: 1,
            exportedAt: new Date().toISOString(),
            snapshot: snapshot.value,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob),
      anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ogori-backup-${today.value}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function chooseBackup(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0]
    if (!file) return
    importError.value = ''
    try {
      if (file.size > 4_000_000) throw new Error('Backup exceeds 4 MB.')
      const backup = JSON.parse(await file.text())
      if (backup.format !== 'ogori-training-backup' || backup.version !== 1)
        throw new Error('Choose an Ogori training backup JSON file.')
      assertState(backup.snapshot?.state)
      restorePreview.value = { name: file.name, state: backup.snapshot.state }
    } catch (cause) {
      importError.value = cause instanceof Error ? cause.message : 'Could not read backup.'
    }
    input.value = ''
  }
  async function restore() {
    if (!restorePreview.value) return
    if (await mutate({ type: 'backup.restore', state: restorePreview.value.state })) {
      restorePreview.value = null
      notice.value = 'Backup restored.'
      selected.value = currentWeek.value
    }
  }
  function leave(event: BeforeUnloadEvent) {
    if (unsaved.value || busy.value || retryCommand) event.preventDefault()
  }
  function refresh() {
    today.value = tokyoToday()
    if (document.visibilityState === 'visible') void load()
  }
  onMounted(() => {
    void load(true)
    poll = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('beforeunload', leave)
    document.addEventListener('visibilitychange', refresh)
  })
  onUnmounted(() => {
    clearInterval(poll)
    for (const timer of timers.values()) clearTimeout(timer)
    window.removeEventListener('focus', refresh)
    window.removeEventListener('beforeunload', leave)
    document.removeEventListener('visibilitychange', refresh)
  })
  return {
    view,
    snapshot,
    loading,
    error,
    busy,
    selected,
    search,
    filter,
    drafts,
    fileInput,
    restoreInput,
    csvPreview,
    restorePreview,
    importError,
    notice,
    state,
    weeks,
    currentWeek,
    week,
    allSessions,
    planned,
    completed,
    coreRuns,
    coreDone,
    daysToRace,
    distance,
    weeklyRuns,
    chartWeeks,
    chartMax,
    chartDescription,
    activities,
    unsaved,
    disabled,
    linked,
    sessionName,
    openWeek,
    navigate,
    mutate,
    patch,
    noteChanged,
    retry,
    chooseCsv,
    confirmImport,
    downloadBackup,
    chooseBackup,
    restore,
  }
}
