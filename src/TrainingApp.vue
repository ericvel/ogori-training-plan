<script setup lang="ts">
import { addDays, runLabel, weekDistance } from '../shared/model.ts'
import { dateLabel, duration, km, pace } from './lib/format.ts'
import { useTraining } from './lib/useTraining.ts'
import AppIcon from './components/AppIcon.vue'
import SessionCard from './components/SessionCard.vue'
const {
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
} = useTraining()
const navigation = [
  { id: 'week', label: 'This week', icon: 'week' },
  { id: 'plan', label: 'Training plan', icon: 'plan' },
  { id: 'activities', label: 'Activities', icon: 'activity' },
  { id: 'settings', label: 'Your data', icon: 'settings' },
]
const titles: Record<string, string> = {
  week: 'This week',
  plan: 'Training plan',
  activities: 'Activity log',
  settings: 'Your data',
}
function range(start: string) {
  return `${dateLabel(start)} – ${dateLabel(addDays(start, 6))}`
}
const displayRaw = (value: string) =>
  value === '--' || !value ? '—' : value.replace(/^'(?=-?\d)/, '')
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="/" @click.prevent="navigate('week')"
        ><span class="brand-symbol"><AppIcon name="activity" :size="23" /></span
        ><span>Ogori<span class="brand-caption">Training companion</span></span></a
      >
      <nav class="primary-nav" aria-label="Main navigation">
        <button
          v-for="item in navigation"
          :key="item.id"
          :class="{ active: view === item.id }"
          :aria-current="view === item.id ? 'page' : undefined"
          @click="navigate(item.id)"
        >
          <AppIcon :name="item.icon" /><span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="sidebar-race">
        <AppIcon name="flag" :size="18" /><strong>Ogori Half Marathon</strong
        ><span>14 March 2027</span><span>21.1 km · Goal under 1:35</span>
      </div>
      <div class="sidebar-account">
        <span class="avatar">E</span
        ><span>Eric<span class="account-detail">Private training space</span></span
        ><span
          class="connection-dot"
          :class="{ 'has-error': error }"
          :title="error ? 'Connection needs attention' : 'Connected'"
        />
      </div>
    </aside>
    <main id="main" class="main-content">
      <header class="page-header">
        <div>
          <h1>{{ titles[view] }}</h1>
          <p>
            {{
              view === 'week'
                ? 'Two core runs. One optional. Make the week yours.'
                : view === 'plan'
                  ? 'Your road to 14 March. One week at a time.'
                  : view === 'activities'
                    ? 'Your runs, connected to your training.'
                    : 'Your training history, kept together.'
            }}
          </p>
        </div>
        <button
          v-if="state && view !== 'settings'"
          class="button primary import-top"
          :disabled="disabled"
          @click="fileInput?.click()"
        >
          <AppIcon name="upload" :size="17" />Import Garmin CSV
        </button>
      </header>
      <input
        ref="fileInput"
        hidden
        type="file"
        accept=".csv,text/csv"
        aria-label="Choose Garmin activity-overview CSV"
        @change="chooseCsv"
      />
      <input
        ref="restoreInput"
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Choose training backup"
        @change="chooseBackup"
      />
      <div v-if="error" class="message error-message" role="alert">
        <div>
          <strong>Connection needs attention</strong>
          <p>{{ error }}</p>
          <p v-if="unsaved">Your note changes remain in this tab. Keep it open until saved.</p>
        </div>
        <button class="button" :disabled="busy > 0" @click="retry">
          {{ snapshot ? 'Retry update' : 'Retry loading' }}</button
        ><a class="text-button" href="/">Reload / sign in</a>
      </div>
      <div v-if="importError" class="message error-message" role="alert">
        <p>{{ importError }}</p>
        <button class="icon-button" aria-label="Dismiss import error" @click="importError = ''">
          <AppIcon name="close" />
        </button>
      </div>
      <div v-if="notice" class="message success-message" role="status">
        <p>{{ notice }}</p>
        <button class="icon-button" aria-label="Dismiss message" @click="notice = ''">
          <AppIcon name="close" />
        </button>
      </div>
      <div v-if="loading" class="loading-state" role="status">
        <div class="skeleton skeleton-title" />
        <div class="skeleton skeleton-panel" />
        <p>Loading your training plan…</p>
      </div>
      <template v-else-if="state">
        <section
          v-if="view === 'week' || view === 'plan'"
          class="race-strip"
          aria-label="Race goal"
        >
          <span class="race-strip-icon"><AppIcon name="flag" /></span>
          <div>
            <strong>Ogori Half Marathon</strong
            ><span>14 March 2027<span class="race-goal"> · Goal under 1:35</span></span>
          </div>
          <div class="race-countdown">
            <strong>{{ Math.abs(daysToRace) }}</strong
            ><span>{{
              daysToRace < 0 ? 'days since race date' : daysToRace === 0 ? 'race day' : 'days to go'
            }}</span>
          </div>
        </section>
        <template v-if="view === 'week' && week">
          <div class="week-toolbar">
            <div class="week-title">
              <h2>Week {{ week.number }}</h2>
              <span>{{ range(week.start) }}</span
              ><span v-if="week.recovery" class="badge">Recovery week</span
              ><span v-if="week.number === 20" class="badge">Taper</span
              ><span v-if="week.number === 21" class="badge">Race week</span>
            </div>
            <div class="week-navigation">
              <button
                v-if="selected !== currentWeek"
                class="text-button"
                @click="selected = currentWeek"
              >
                Current week</button
              ><button
                class="icon-button"
                aria-label="Previous week"
                :disabled="selected === weeks[0]?.number"
                @click="selected--"
              >
                <AppIcon class="reversed" name="arrow" :size="17" /></button
              ><label class="visually-hidden" for="week-select">Choose week</label
              ><select id="week-select" v-model="selected">
                <option v-for="w in weeks" :key="w.number" :value="w.number">
                  Week {{ w.number }}
                </option></select
              ><button
                class="icon-button"
                aria-label="Next week"
                :disabled="selected === weeks.at(-1)?.number"
                @click="selected++"
              >
                <AppIcon name="arrow" :size="17" />
              </button>
            </div>
          </div>
          <div class="week-layout">
            <section class="sessions" aria-label="This week's sessions">
              <SessionCard
                v-for="session in week.sessions"
                :key="session.id"
                :session="session"
                :progress="state.progress[session.id]"
                :activities="linked(session.id)"
                :busy="disabled"
                :unsaved="Object.hasOwn(drafts, session.id)"
                :draft="drafts[session.id]"
                @patch="patch"
                @note="noteChanged"
              />
              <p class="schedule-note">
                Run on the days that work for you. Keep a non-running day between sessions.
              </p>
            </section>
            <aside class="week-insights">
              <section class="insight-panel">
                <h2>Running this week</h2>
                <p class="distance-total">{{ km(distance) }}<span>km</span></p>
                <p class="muted small">
                  {{ weeklyRuns }} recorded {{ weeklyRuns === 1 ? 'run' : 'runs' }} · actual run
                  dates
                </p>
                <div class="distance-chart" role="img" :aria-label="chartDescription">
                  <div v-for="w in chartWeeks" :key="w.number" class="chart-column">
                    <span class="chart-value">{{
                      weekDistance(state, w) ? km(weekDistance(state, w)) : ''
                    }}</span>
                    <div class="bar-track">
                      <div
                        class="chart-bar"
                        :class="{ selected: w.number === selected }"
                        :style="{
                          height: `${Math.max(2, (weekDistance(state, w) / chartMax) * 100)}%`,
                        }"
                      />
                    </div>
                    <span class="chart-label" :class="{ selected: w.number === selected }"
                      >W{{ w.number }}</span
                    >
                  </div>
                </div>
              </section>
              <section class="insight-panel plan-progress">
                <h2>Plan progress</h2>
                <div class="progress-copy">
                  <strong
                    >{{ completed }}<span> / {{ planned.length }}</span></strong
                  ><span class="muted small">planned sessions</span>
                </div>
                <progress
                  :value="completed"
                  :max="planned.length"
                  aria-label="Planned sessions completed"
                />
                <p class="small muted">
                  {{ coreDone }} of {{ coreRuns.length }} core runs completed
                </p>
                <button class="text-button" @click="navigate('plan')">
                  View full training plan <AppIcon name="arrow" :size="15" />
                </button>
              </section>
              <section v-if="week.recovery" class="recovery-note">
                <h2>Room to recover</h2>
                <p>Keep this week easy. Recovery is part of the plan.</p>
              </section>
            </aside>
          </div>
          <details class="guidance">
            <summary>How to use your plan<AppIcon name="down" :size="17" /></summary>
            <ul>
              <li v-for="line in state.plan.guidance" :key="line">{{ line }}</li>
            </ul>
          </details>
        </template>
        <section v-else-if="view === 'plan'" class="plan-list">
          <div class="section-heading">
            <h2>{{ weeks.length }} weeks to the start line</h2>
            <span class="muted small"
              >{{ completed }} / {{ planned.length }} planned sessions completed</span
            >
          </div>
          <button
            v-for="w in weeks"
            :key="w.number"
            class="plan-week"
            :class="{ current: w.number === currentWeek }"
            @click="openWeek(w.number)"
          >
            <div class="plan-week-number">
              Week {{ w.number
              }}<span v-if="w.number === currentWeek" class="current-label">Current</span>
            </div>
            <div class="plan-week-description">
              <strong>{{ range(w.start) }}</strong
              ><span>{{
                w.recovery
                  ? 'Recovery week'
                  : w.number === 20
                    ? 'Taper week'
                    : w.number === 21
                      ? 'Race week'
                      : w.sessions.find((s) => s.id.endsWith('-a'))?.title
              }}</span>
            </div>
            <div class="week-session-marks">
              <span
                v-for="s in w.sessions.filter((s) => s.kind !== 'Extra')"
                :key="s.id"
                class="session-mark"
                :class="state.progress[s.id]?.status ?? 'pending'"
                :title="`${runLabel(s)}: ${state.progress[s.id]?.status ?? 'pending'}`"
                ><AppIcon
                  v-if="state.progress[s.id]?.status === 'completed'"
                  name="check"
                  :size="13"
                /><span v-else>{{
                  s.kind === 'Race'
                    ? 'R'
                    : s.kind === 'Optional'
                      ? '+'
                      : s.id.endsWith('-a')
                        ? 'A'
                        : 'B'
                }}</span></span
              >
            </div>
            <span class="plan-week-distance"
              >{{ km(weekDistance(state, w)) }}<small> km</small></span
            ><AppIcon name="arrow" :size="17" />
          </button>
        </section>
        <template v-else-if="view === 'activities'">
          <section v-if="csvPreview" class="import-preview">
            <div class="section-heading">
              <h2>Review import</h2>
              <button
                class="icon-button"
                aria-label="Cancel import"
                :disabled="disabled"
                @click="csvPreview = null"
              >
                <AppIcon name="close" />
              </button>
            </div>
            <p class="file-name">{{ csvPreview.name }}</p>
            <div class="import-totals">
              <span
                ><strong>{{ csvPreview.summary.added }}</strong
                >new</span
              ><span
                ><strong>{{ csvPreview.summary.updated }}</strong
                >existing</span
              ><span
                ><strong>{{ csvPreview.summary.linked }}</strong
                >linked to sessions</span
              ><span
                ><strong>{{ csvPreview.summary.unlinked }}</strong
                >unlinked</span
              >
            </div>
            <p v-if="csvPreview.summary.extras" class="small">
              {{ csvPreview.summary.extras }} extra optional
              {{ csvPreview.summary.extras === 1 ? 'run' : 'runs' }} will appear in the named week.
            </p>
            <p class="muted small">
              Linked sessions will be marked completed. Existing notes and history are preserved.
              Manual links stay as chosen.
            </p>
            <button class="button primary" :disabled="disabled || unsaved" @click="confirmImport">
              {{ busy ? 'Importing…' : 'Confirm import' }}
            </button>
          </section>
          <div class="activity-toolbar">
            <div class="search-field">
              <label class="visually-hidden" for="activity-search">Search activities</label
              ><input
                id="activity-search"
                v-model="search"
                type="search"
                placeholder="Search runs or dates"
              />
            </div>
            <label class="visually-hidden" for="activity-filter">Filter activities</label
            ><select id="activity-filter" v-model="filter">
              <option value="all">All activities</option>
              <option value="unlinked">Unlinked activities</option></select
            ><span class="muted small activity-count">{{ activities.length }} activities</span>
          </div>
          <div v-if="!activities.length" class="empty-state">
            <AppIcon name="activity" :size="32" />
            <h2>
              {{
                state.activities.length ? 'No matching runs' : 'Your running history starts here'
              }}
            </h2>
            <p>
              {{
                state.activities.length
                  ? 'Try another search or show all activities.'
                  : 'Import an activity-overview CSV from Garmin Connect to see your runs and weekly totals.'
              }}
            </p>
            <button
              v-if="!state.activities.length"
              class="button primary"
              :disabled="disabled"
              @click="fileInput?.click()"
            >
              Import Garmin CSV
            </button>
          </div>
          <section v-else class="activity-list" aria-label="Imported Garmin activities">
            <details v-for="activity in activities" :key="activity.id" class="activity-row">
              <summary>
                <div class="activity-date">
                  <strong>{{ dateLabel(activity.startedAt, { day: 'numeric' }) }}</strong
                  ><span>{{ dateLabel(activity.startedAt, { month: 'short' }) }}</span>
                </div>
                <div class="activity-name">
                  <strong>{{ activity.title || activity.type }}</strong
                  ><span>{{
                    activity.sessionId ? sessionName(activity.sessionId) : 'Unlinked activity'
                  }}</span>
                </div>
                <div class="activity-stat">
                  <strong>{{ km(activity.distanceKm) }}<small> km</small></strong
                  ><span>{{ duration(activity.durationSeconds) }}</span>
                </div>
                <div class="activity-stat pace-stat">
                  <strong>{{ pace(activity.paceSeconds) }}</strong
                  ><span>min/km</span>
                </div>
                <AppIcon name="down" :size="17" />
              </summary>
              <div class="activity-detail">
                <div class="activity-link-control">
                  <label :for="`link-${activity.id}`">Linked session</label
                  ><select
                    :id="`link-${activity.id}`"
                    :value="activity.sessionId ?? ''"
                    :disabled="disabled"
                    @change="
                      mutate({
                        type: 'activity.link',
                        id: activity.id,
                        sessionId: ($event.target as HTMLSelectElement).value || null,
                      })
                    "
                  >
                    <option value="">Not linked</option>
                    <optgroup v-for="w in weeks" :key="w.number" :label="`Week ${w.number}`">
                      <option v-for="s in w.sessions" :key="s.id" :value="s.id">
                        {{ runLabel(s) }} · {{ s.title }}
                      </option>
                    </optgroup>
                  </select>
                  <p v-if="activity.linkSource === 'manual'" class="muted small">
                    Manual choice · preserved on reimport
                  </p>
                  <p v-else-if="activity.linkSource === 'name'" class="muted small">
                    Matched from Garmin activity name
                  </p>
                </div>
                <dl class="metrics-grid">
                  <div v-for="(value, key) in activity.raw" :key="key">
                    <dt>{{ key }}</dt>
                    <dd>{{ displayRaw(value) }}</dd>
                  </div>
                </dl>
              </div>
            </details>
          </section>
          <p class="data-footnote">
            Kilometres · min/km · Japan time. Weekly totals use actual dates. Names such as
            <code>week4coreA</code> link runs to their intended session.
          </p>
        </template>
        <template v-else-if="view === 'settings'">
          <section class="settings-section">
            <h2>Keep a copy</h2>
            <p>
              Download your complete plan, progress, notes, Garmin activities, and session links.
            </p>
            <button class="button primary" :disabled="disabled || unsaved" @click="downloadBackup">
              <AppIcon name="download" :size="17" />Download backup
            </button>
            <p v-if="unsaved" class="small muted">
              Wait for note changes to save before downloading.
            </p>
          </section>
          <section class="settings-section">
            <h2>Import from Garmin Connect</h2>
            <p>
              Export your activity list as CSV. Rename runs to <code>week3coreA</code>,
              <code>week3coreB</code>, or <code>week4optional</code> to link them automatically.
              Older runs can be linked manually.
            </p>
            <p>
              Reimporting refreshes existing records without duplicating runs. Activities missing
              from a later export remain in your history.
            </p>
            <button class="button" :disabled="disabled" @click="fileInput?.click()">
              <AppIcon name="upload" :size="17" />Choose Garmin CSV
            </button>
          </section>
          <section class="settings-section">
            <h2>Restore a backup</h2>
            <p>
              Choose a backup from this app. Review it before replacing your current training data.
            </p>
            <button class="button" :disabled="disabled || unsaved" @click="restoreInput?.click()">
              Choose backup
            </button>
            <div v-if="restorePreview" class="restore-preview">
              <h3>Replace current data?</h3>
              <p>
                {{ restorePreview.name }} contains
                {{ restorePreview.state.plan.weeks.length }} weeks and
                {{ restorePreview.state.activities.length }} activities. This replaces the current
                plan, progress, and history.
              </p>
              <div class="button-row">
                <button class="button danger" :disabled="disabled" @click="restore">
                  Replace with backup</button
                ><button class="button" :disabled="disabled" @click="restorePreview = null">
                  Cancel
                </button>
              </div>
            </div>
          </section>
          <section class="settings-section">
            <h2>Your training space</h2>
            <p>
              Private to your approved Google account. Changes sync between devices while connected.
              Garmin analysis and plan adjustments stay in our coaching chat.
            </p>
            <dl class="settings-facts">
              <div>
                <dt>Race</dt>
                <dd>Ogori Half Marathon · 14 March 2027</dd>
              </div>
              <div>
                <dt>Goal</dt>
                <dd>{{ state.plan.goal }}</dd>
              </div>
              <div>
                <dt>Units</dt>
                <dd>Kilometres · min/km · Japan time</dd>
              </div>
            </dl>
            <a class="text-button" href="/cdn-cgi/access/logout">Sign out</a>
          </section>
        </template>
      </template>
      <footer v-if="state" class="page-footer">
        <span>Ogori · 14 March 2027</span><span>One week at a time.</span>
      </footer>
    </main>
    <nav class="mobile-nav" aria-label="Mobile navigation">
      <button
        v-for="item in navigation"
        :key="item.id"
        :class="{ active: view === item.id }"
        :aria-current="view === item.id ? 'page' : undefined"
        @click="navigate(item.id)"
      >
        <AppIcon :name="item.icon" /><span>{{
          item.id === 'plan' ? 'Plan' : item.id === 'settings' ? 'Your data' : item.label
        }}</span>
      </button>
    </nav>
  </div>
</template>
