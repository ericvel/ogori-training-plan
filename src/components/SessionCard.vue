<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Activity, Progress, Session } from '../../shared/model.ts'
import { blankProgress, runLabel, tokyoToday } from '../../shared/model.ts'
import { dateLabel, duration, km, pace } from '../lib/format.ts'
import AppIcon from './AppIcon.vue'
const props = defineProps<{
  session: Session
  progress?: Progress
  activities: Activity[]
  busy: boolean
  unsaved?: boolean
  draft?: string
}>()
const emit = defineEmits<{
  patch: [id: string, patch: Partial<Progress>]
  note: [id: string, note: string]
}>()
const current = computed(() => props.progress ?? blankProgress())
const note = ref(props.draft ?? current.value.note)
const focused = ref(false)
watch(
  () => props.progress?.note,
  (value) => {
    if (!focused.value && !props.unsaved) note.value = value ?? ''
  },
)
watch(
  () => props.draft,
  (value) => {
    if (value !== undefined) note.value = value
  },
)
function complete() {
  const completed = current.value.status === 'completed'
  emit('patch', props.session.id, {
    status: completed ? 'pending' : 'completed',
    actualDate: completed ? null : (current.value.actualDate ?? tokyoToday()),
  })
}
</script>
<template>
  <article
    class="session-card"
    :class="{ completed: current.status === 'completed', skipped: current.status === 'skipped' }"
  >
    <div class="session-heading">
      <button
        class="completion-control"
        :class="{ checked: current.status === 'completed' }"
        :aria-pressed="current.status === 'completed'"
        :aria-label="`${current.status === 'completed' ? 'Mark unfinished' : 'Complete'}: ${runLabel(session)}`"
        :disabled="busy"
        @click="complete"
      >
        <AppIcon v-if="current.status === 'completed'" name="check" :size="19" />
      </button>
      <div class="session-copy">
        <div class="run-label">
          {{ runLabel(session)
          }}<span v-if="current.status === 'completed'" class="status-label">Completed</span
          ><span v-else-if="current.status === 'skipped'" class="status-label">Skipped</span>
        </div>
        <h3>{{ session.title }}</h3>
        <p v-if="current.status === 'completed'" class="session-date">
          {{
            current.actualDate
              ? dateLabel(current.actualDate, { weekday: 'short', day: 'numeric', month: 'short' })
              : 'Previously completed · date not recorded'
          }}
        </p>
      </div>
      <button
        class="text-button skip-control"
        :disabled="busy"
        @click="
          emit('patch', session.id, {
            status: current.status === 'skipped' ? 'pending' : 'skipped',
            actualDate: null,
          })
        "
      >
        {{ current.status === 'skipped' ? 'Undo skip' : 'Skip' }}
      </button>
    </div>
    <div class="session-body">
      <label class="note-label" :for="`note-${session.id}`"
        >Notes<span v-if="unsaved" class="unsaved-note"> · Unsaved</span></label
      >
      <input
        :id="`note-${session.id}`"
        v-model="note"
        class="note-input"
        type="text"
        maxlength="4000"
        autocomplete="off"
        @focus="focused = true"
        @blur="focused = false"
        @input="emit('note', session.id, note)"
      />
      <details class="workout-details">
        <summary>
          Workout details
          <span v-if="activities.length" class="linked-count"
            >{{ activities.length }} linked
            {{ activities.length === 1 ? 'activity' : 'activities' }}</span
          ><AppIcon name="down" :size="16" />
        </summary>
        <div class="workout-inner">
          <ul v-if="session.instructions?.length">
            <li v-for="instruction in session.instructions" :key="instruction">
              {{ instruction }}
            </li>
          </ul>
          <p v-else>{{ session.title }}</p>
          <label class="date-field"
            >Actual run date<input
              type="date"
              :value="current.actualDate ?? ''"
              :disabled="busy"
              @change="
                emit('patch', session.id, {
                  actualDate: ($event.target as HTMLInputElement).value || null,
                })
              "
          /></label>
          <div v-for="activity in activities" :key="activity.id" class="linked-activity">
            <AppIcon name="link" :size="16" />
            <div>
              <strong>{{ activity.title }}</strong
              ><span
                >{{ km(activity.distanceKm) }} km · {{ duration(activity.durationSeconds) }} ·
                {{ pace(activity.paceSeconds) }}/km<span v-if="activity.averageHr">
                  · {{ activity.averageHr }} bpm</span
                ></span
              >
            </div>
          </div>
        </div>
      </details>
    </div>
  </article>
</template>
