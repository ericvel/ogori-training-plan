<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Activity, LapData } from '../../shared/model.ts'
import type { Command } from '../../shared/commands.ts'
import {
  hasWorkoutSteps,
  isWorkLap,
  lapMismatch,
  parseGarminLaps,
  sameLapData,
} from '../../shared/laps.ts'
import { dateLabel, duration, km, lapDuration } from '../lib/format.ts'
import LapTable from './LapTable.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  activity: Activity
  disabled: boolean
  save: (command: Command) => Promise<boolean>
  compact?: boolean
}>()
const input = ref<HTMLInputElement | null>(null)
const preview = ref<{ csv: string; name: string; data: LapData } | null>(null)
const error = ref(''),
  notice = ref(''),
  reading = ref(false),
  saving = ref(false)
const acceptMismatch = ref(false),
  removing = ref(false)
const reviewing = ref(false)
const blocked = computed(() => props.disabled || reading.value || saving.value)
const mismatch = computed(() => !!preview.value && lapMismatch(props.activity, preview.value.data))
const identical = computed(
  () => !!preview.value && sameLapData(props.activity.lapData, preview.value.data),
)
const displayed = computed(() => preview.value?.data ?? props.activity.lapData)
const work = computed(() => {
  const laps = displayed.value?.laps
  return laps && hasWorkoutSteps(laps) ? laps.filter(isWorkLap) : []
})
watch([() => props.activity.distanceKm, () => props.activity.durationSeconds], () => {
  acceptMismatch.value = false
})
function toggleReview() {
  reviewing.value = !reviewing.value
  removing.value = false
}

async function choose(event: Event) {
  const element = event.target as HTMLInputElement,
    file = element.files?.[0]
  if (!file) return
  reading.value = true
  error.value = ''
  notice.value = ''
  preview.value = null
  acceptMismatch.value = false
  removing.value = false
  try {
    if (file.size > 2_000_000)
      throw new Error('Lap CSV exceeds 2 MB. Choose a smaller individual activity export.')
    const csv = await file.text()
    preview.value = { csv, name: file.name, data: parseGarminLaps(csv) }
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Could not read lap CSV. Choose the file again.'
  } finally {
    reading.value = false
    element.value = ''
  }
}
async function confirm() {
  if (
    !preview.value ||
    blocked.value ||
    (!identical.value && mismatch.value && !acceptMismatch.value)
  )
    return
  if (identical.value) {
    preview.value = null
    notice.value = 'These laps are already attached. No changes made.'
    return
  }
  saving.value = true
  try {
    if (
      await props.save({
        type: 'activity.laps.import',
        id: props.activity.id,
        csv: preview.value.csv,
        acceptMismatch: acceptMismatch.value,
      })
    ) {
      preview.value = null
      notice.value = 'Laps saved.'
    }
  } finally {
    saving.value = false
  }
}
async function remove() {
  if (blocked.value) return
  saving.value = true
  try {
    if (await props.save({ type: 'activity.laps.remove', id: props.activity.id })) {
      removing.value = false
      notice.value = 'Laps removed.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="activity-laps" :class="{ compact }" aria-label="Activity laps">
    <div class="lap-heading">
      <h3 v-if="!compact">
        Laps<span v-if="activity.lapData" class="muted small">
          · {{ activity.lapData.laps.length }}</span
        >
      </h3>
      <div class="lap-actions">
        <button class="button" :disabled="blocked" @click="input?.click()">
          <AppIcon name="upload" :size="16" />{{ reading ? 'Reading…' : 'Import lap CSV' }}
        </button>
        <button
          v-if="compact && activity.lapData && !preview"
          class="text-button"
          :disabled="blocked"
          :aria-expanded="reviewing"
          @click="toggleReview"
        >
          {{ reviewing ? 'Hide laps' : `Review ${activity.lapData.laps.length} laps` }}
        </button>
        <button
          v-if="activity.lapData && !preview && (!compact || reviewing)"
          class="text-button"
          :disabled="blocked"
          @click="removing = !removing"
        >
          Remove laps
        </button>
      </div>
    </div>
    <input
      ref="input"
      hidden
      type="file"
      accept=".csv,text/csv"
      :aria-label="`Choose lap CSV for ${activity.title || activity.type}`"
      @change="choose"
    />
    <p v-if="error" class="message error-message" role="alert">{{ error }}</p>
    <p v-if="notice" class="small" role="status">{{ notice }}</p>
    <div v-if="removing && activity.lapData" class="lap-confirmation">
      <p>Remove all {{ activity.lapData.laps.length }} laps from this activity?</p>
      <div class="lap-actions">
        <button class="button danger" :disabled="blocked" @click="remove">
          {{ saving ? 'Removing…' : 'Confirm removal' }}
        </button>
        <button class="button" :disabled="blocked" @click="removing = false">Cancel</button>
      </div>
    </div>
    <div v-if="preview" class="lap-preview">
      <div class="lap-heading">
        <h3>Review lap import</h3>
        <button class="text-button" :disabled="blocked" @click="preview = null">
          Cancel import
        </button>
      </div>
      <p class="file-name">{{ preview.name }}</p>
      <p class="small">
        Attach to <strong>{{ activity.title || activity.type }}</strong> ·
        {{
          dateLabel(activity.startedAt, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        }}
      </p>
      <dl class="lap-totals">
        <div>
          <dt>Selected activity</dt>
          <dd>{{ km(activity.distanceKm) }} km · {{ duration(activity.durationSeconds) }}</dd>
        </div>
        <div>
          <dt>CSV totals · {{ preview.data.laps.length }} laps</dt>
          <dd>
            {{ km(preview.data.totals.distanceKm) }} km ·
            {{ lapDuration(preview.data.totals.durationSeconds) }}
          </dd>
        </div>
      </dl>
      <p class="small muted">
        Metric export assumed: kilometres, min/km, bpm. Check this file belongs to the selected
        activity.
      </p>
      <p v-if="identical" class="small" role="status">
        These laps are already attached. No changes needed.
      </p>
      <template v-else>
        <p v-if="activity.lapData" class="small">
          <strong>This replaces all {{ activity.lapData.laps.length }} existing laps.</strong>
        </p>
        <div v-if="mismatch" class="lap-mismatch" role="alert">
          <p>
            <strong>Totals differ from this activity.</strong> Check the activity and file before
            continuing.
          </p>
          <label
            ><input v-model="acceptMismatch" type="checkbox" :disabled="blocked" />I checked the
            totals and want to attach this file to this activity.</label
          >
        </div>
      </template>
    </div>
    <template v-if="displayed && (!compact || preview || reviewing)">
      <LapTable v-if="work.length" :laps="work" caption="Work splits" highlight-work />
      <LapTable
        :laps="displayed.laps"
        :caption="preview ? 'Lap import preview' : 'Recorded laps'"
        :highlight-work="work.length > 0"
      />
      <p v-if="preview || work.length" class="small muted lap-note">
        <template v-if="preview">Preview only. Save to attach these laps.</template>
        <template v-else>Sustained work intervals can inform upcoming pace estimates.</template>
      </p>
    </template>
    <p v-else-if="!displayed && !compact" class="small muted">
      Import an individual Garmin activity CSV to review lap splits and workout intervals.
    </p>
    <div v-if="preview" class="lap-actions lap-save">
      <button
        class="button primary"
        :disabled="blocked || (!identical && mismatch && !acceptMismatch)"
        @click="confirm"
      >
        {{
          saving
            ? 'Saving…'
            : identical
              ? 'Keep existing laps'
              : activity.lapData
                ? 'Confirm replacement'
                : 'Save laps'
        }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.activity-laps {
  min-width: 0;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.activity-laps.compact {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
.compact > .lap-heading {
  margin-bottom: 0;
}
.lap-heading,
.lap-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.lap-heading {
  justify-content: space-between;
  margin-bottom: 12px;
}
.lap-heading h3 {
  font-size: 15px;
}
.lap-preview,
.lap-confirmation {
  padding: 16px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  margin: 16px 0;
}
.lap-preview p + p,
.lap-confirmation .lap-actions {
  margin-top: 10px;
}
.lap-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 32px;
  margin: 16px 0;
}
.lap-totals dt {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 6px;
}
.lap-totals dd {
  margin: 0;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.lap-mismatch {
  color: #80382d;
  background: #fff3ef;
  border: 1px solid #e7c3bb;
  border-radius: 9px;
  padding: 12px;
  margin-top: 16px;
  font-size: 13px;
}
.lap-mismatch label {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  cursor: pointer;
}
.lap-mismatch input {
  flex-shrink: 0;
  accent-color: var(--blue);
}
.lap-note,
.lap-save {
  margin-top: 16px;
}
</style>
