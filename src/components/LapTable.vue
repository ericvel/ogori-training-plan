<script setup lang="ts">
import type { ActivityLap } from '../../shared/model.ts'
import { isWorkLap } from '../../shared/laps.ts'
import { lapDuration, km } from '../lib/format.ts'
defineProps<{ laps: ActivityLap[]; caption: string; highlightWork?: boolean }>()
</script>

<template>
  <div class="lap-table-scroll" role="region" :aria-label="caption" tabindex="0">
    <table class="lap-table">
      <caption>
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">Lap / step</th>
          <th scope="col">Time</th>
          <th scope="col">Pace <span>min/km</span></th>
          <th scope="col">km</th>
          <th scope="col">Avg HR <span>bpm</span></th>
          <th scope="col">Max HR <span>bpm</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="lap in laps"
          :key="lap.number"
          :class="{ 'work-lap': highlightWork && isWorkLap(lap) }"
        >
          <th scope="row">
            {{ lap.number
            }}<span v-if="lap.stepType" class="lap-step">{{
              highlightWork && isWorkLap(lap) && lap.interval !== null
                ? `Work ${lap.interval}`
                : lap.stepType
            }}</span>
          </th>
          <td>{{ lapDuration(lap.durationSeconds) }}</td>
          <td>{{ lap.paceSeconds === null ? '—' : lapDuration(lap.paceSeconds) }}</td>
          <td>{{ km(lap.distanceKm) }}</td>
          <td>{{ lap.averageHr ?? '—' }}</td>
          <td>{{ lap.maxHr ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p class="lap-scroll-hint muted">Scroll table for distance and heart rate.</p>
</template>

<style scoped>
.lap-table-scroll {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-color: #8d9db4 #edf0f5;
  margin-top: 16px;
}
.lap-table {
  width: 100%;
  min-width: 530px;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
caption {
  text-align: left;
  font-weight: 600;
  padding-bottom: 12px;
}
th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  text-align: right;
  white-space: nowrap;
}
thead th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 550;
}
thead span {
  display: block;
  font-weight: 400;
}
th:first-child {
  text-align: left;
  padding-left: 8px;
}
tbody th {
  font-weight: 550;
}
.lap-step {
  display: block;
  font-size: 12px;
  font-weight: 400;
  max-width: 160px;
  white-space: normal;
  overflow-wrap: anywhere;
}
.work-lap {
  background: var(--blue-light);
}
.work-lap th {
  color: var(--blue);
}
.lap-scroll-hint {
  display: none;
}
@media (max-width: 760px) {
  .lap-scroll-hint {
    display: block;
    margin-top: 8px;
    font-size: 12px;
  }
}
</style>
