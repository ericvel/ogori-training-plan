# Ogori training companion

Private Vue app for the March 14, 2027 Ogori Half Marathon. Shows the current training week, records completion/skips/dates/notes, imports Garmin activity-overview CSVs, links named runs, and exports/restores complete backups. Progress syncs through Cloudflare D1. Coaching and changes to the plan remain in chat.

## Local development

Use Node 24.15+ (Node 24.12 also runs the current build). Install dependencies with `npm ci`.

1. Prepare the initial migration, reading the old tracker without editing it:

   ```sh
   npm run prepare:migration -- --source-dir /absolute/path/to/local-tracker --csv /absolute/path/to/overview.csv
   ```

   The script preserves stable IDs, all legacy notes/completions, and original guidance. Known Garmin dates populate linked sessions; legacy-only completions retain unknown dates. It writes ignored `.private/initial-state.json` and `.private/seed.sql`. Seed SQL uses `ON CONFLICT DO NOTHING`, so rerunning it never resets progress.

2. Create ignored `.dev.vars`:

   ```dotenv
   OWNER_EMAIL="eric.vel@outlook.com"
   DEV_AUTH="true"
   ```

   The local bypass requires both this explicit flag and a loopback URL. Production rejects missing Access configuration regardless of this flag. Never set `DEV_AUTH` in Cloudflare.

3. Initialize the local database and build:

   ```sh
   npm run db:migrate:local
   npm run db:seed:local
   npm run build
   ```

4. Run `npm run dev:api` in one terminal and `npm run dev` in another. Open the Vite URL (normally `http://127.0.0.1:5173`). Both servers bind to loopback. Vite proxies `/api` to the local Pages Functions runtime on port 8788.

## Verification

```sh
npm test
npm run build
npx wrangler pages functions build --outdir .private/functions-build
```

Tests use synthetic data and in-memory SQLite. They cover Garmin parsing, reimports, collisions, extra runs, preserved history, weekly date boundaries, backup validation, JWT ownership/signature/issuer/audience/expiry, origin checks, and simultaneous device writes. `build` checks Vue and Functions types before compiling the browser app. GitHub Actions runs these checks for pushes and pull requests.

## Garmin CSV contract

### Displayed pace estimates

Workout cards show estimated numeric ranges beside their titles, with the original effort cue. Computation stays in the browser using authenticated activity history. Ranges update after imports, link changes, or lap replacement or removal.

Estimates use the eight weeks ending on the latest run of at least 3 km and 20 minutes. A qualifying continuous run contributes one sample based on its duration and distance, including when ordinary splits are attached. A structured workout can contribute one sample from its Garmin `Run` laps. Consecutive splits within a numbered interval or a block of unnumbered `Run` laps are grouped. Work intervals must last at least two minutes each and total at least ten minutes. Work pace uses total work time divided by total work distance, excluding warm-up, recovery, and cool-down.

Easy ranges span at least three recorded, linked continuous easy runs. Faster ranges use the median of the three fastest distance-adjusted samples, with Riegel's exponent 1.07 for 10 km, approximately hour-long tempo effort, and half-marathon effort. Bounds allow 10 seconds/km and round outward to five seconds. These ranges are training estimates. Effort takes priority, and easy running has no minimum pace. With fewer than three samples, cards show effort guidance. See [V.O2 guidance on adjusting training paces](https://support.vdoto2.com/2022/03/adjusting-your-training-paces-on-v-o2/) and the [Riegel model described by Vickers and Vertosick](https://doi.org/10.1186/s13102-016-0052-y).

### Import format

Use the activity-overview export, with headers `Activity Type`, `Date`, `Title`, `Distance`, and `Time`. Other columns are retained; order is irrelevant. UTF-8, BOM, comma delimiters, quoted commas/newlines, doubled quotes, CRLF/LF, fractional durations, thousands separators, `--` missing metrics, and apostrophe-prefixed negative elevation are handled. Individual lap/interval exports are attached separately from a run's expanded details.

- Dates: `YYYY-MM-DD HH:MM:SS`, interpreted in Asia/Tokyo.
- Distance: kilometres. Durations: `HH:MM:SS`; pace: `M:SS` per kilometre.
- Name tags, case-insensitive: `week3coreA`, `week3coreB`, `week4optional`; `week21race` also matches the race's original `w21-b` ID.
- Missing optional slots become stable `wN-extra-optional` records, separate from prescribed sessions. Original week ranges and IDs remain intact.
- Non-running activities stay in history but do not contribute to running-distance totals or automatic links.
- Weekly totals use actual dates, even when the name links a run to a different week.
- Identity uses activity type + exact start timestamp because this CSV has no Garmin activity IDs. Renaming updates the same record. Conflicting distance/duration, duplicate identities, and competing automatic session claims reject the entire import with an explanation.
- Manual links/unlinks survive subsequent exports. Removing a link or renaming a run does not erase previously recorded completion; correct status explicitly if needed.
- Imports merge; absence from a later file never deletes history. Preview shows new/existing/linked/unlinked counts before confirmation.
- Files up to 2 MB and 10,000 rows are parsed. Stored state is capped at 1.8 MB, below D1's per-value limit. Raw exported metrics are preserved in backups.

### Individual activity laps

Open a running activity in **Activities → Import lap CSV**. Choose an individual Garmin activity CSV, review its laps and totals beside the selected activity, then save. These files have no internal activity identity; attachment is explicit. English headers and metric exports (km, min/km, bpm) are supported.

On **This week**, tempo, interval/repetition, hill, stride, progression, race-pace, benchmark, and race workouts also expose **Import lap CSV** directly on their cards. With one linked running activity the button opens the file chooser immediately; with multiple linked runs, choose the run first. Without a linked run, **Link a run** opens Activities. Preview and confirmation stay inline, and saved laps can be reviewed from the card.

- Ordinary exports use `Laps`; structured workouts use `Lap`, `Interval`, and `Step Type`. Both require `Time` and `Distance`. Column order is irrelevant. Summary and grouped range rows are excluded from the lap table; group labels are retained on their individual laps.
- Only lap/workout identifiers, labels, duration, distance, exported average pace, average HR, and maximum HR are retained. Missing optional pace/HR values display “—”. Lap tables display the exported pace and preserve fractional seconds.
- `Run` splits with positive time and distance appear in a compact work comparison for structured workouts and are emphasized in the complete lap table. Unlabeled runs show ordinary splits.
- Preview compares the CSV summary (or individual-lap sums when no summary exists) with the selected activity. A difference greater than the larger of 0.10 km or 1% of activity distance, or the larger of 5 seconds or 1% of activity duration, requires explicit mismatch confirmation. Normal export rounding is tolerated.
- A confirmed reimport replaces the entire lap dataset. Identical normalized data makes no change; **Remove laps** requires confirmation. Invalid files are rejected as a whole.
- Overview reimports preserve attached laps. Backups include them and accept older backups without laps. Eligible work intervals inform estimated training paces.
- The existing CSV and stored-state size limits also apply to lap imports. Original lap CSVs and their extra metrics are not stored.

## Cloudflare production setup

Existing GitHub `main` integration publishes to `ogori-training-plan.pages.dev`. Keep build command `npm run build`, output `dist`, and Node 24.15+. Do not push a release before private access and storage are configured.

1. Use the connected Cloudflare account to manage the app's D1, Pages, and Zero Trust resources. `wrangler.jsonc` is the source of truth for the production and preview D1 bindings and Access variables; database IDs and Access audience tags are configuration, not credentials.
2. Apply `migrations/0001_state.sql` to each database and seed only an intended empty production database from `.private/seed.sql`. The one-time seed cannot overwrite an existing state record. Keep preview test changes separate from production history.
3. Use Cloudflare account login as the Access identity provider. Restrict it to account members, allow only the exact owner email (`eric.vel@outlook.com`) in the reusable owner policy, and enable direct identity-provider redirect to avoid the provider chooser. No Google OAuth client is needed.
4. Protect **both production and preview URLs**, using Cloudflare's [production pages.dev instructions](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain). The production Access application covers `ogori-training-plan.pages.dev`; the preview application covers `*.ogori-training-plan.pages.dev`. Verify both, including historical deployment URLs.
5. Set the Access app and owner policy session duration to 30 days. The user's Cloudflare account may separately require reauthentication according to its account settings.

   In Pages **Settings → Runtime**, set **Fail open / closed** to **Fail closed** so static assets are not served when Functions hit the free-tier request limit. This runtime switch is managed in the Pages project settings, separately from Wrangler's tracked bindings and variables.
6. Confirm the production and preview Pages Functions variables match their separate `wrangler.jsonc` entries:

   | Variable             | Value                                                  |
   | -------------------- | ------------------------------------------------------ |
   | `OWNER_EMAIL`        | Exact approved owner email (`eric.vel@outlook.com`)     |
   | `ACCESS_TEAM_DOMAIN` | Team hostname, e.g. `your-team.cloudflareaccess.com`   |
   | `ACCESS_AUD`         | Audience tag for that environment's Access application |

   API requests require a valid signed Access JWT with the configured issuer/audience and owner email. Missing configuration fails closed. Never configure a production authentication bypass.

7. Verify an unauthenticated browser is redirected to Cloudflare account sign-in, an unapproved account cannot enter, and `/api/state` never exposes data without valid authorization. Verify owner-account sync on phone and computer, then release through GitHub `main`.

The repository contains no imported CSVs, progress files, seed data, or credentials. `.private`, `.wrangler`, `.dev.vars`, and local environment files are ignored. Static assets contain the interface only; personal records are loaded from the authenticated API. API and static responses request no caching; no service worker or offline queue exists.

## Persistence and recovery

D1 stores one versioned JSON document. Writes use a revision check and atomic conditional update. A stale device receives the latest saved state and an explicit conflict; it cannot silently overwrite another device. Notes remain in the current tab until saved, with visible errors and retry. There is no offline persistence: keep the tab open if a save fails.

Your data → Download backup saves the plan, every progress record, imported raw metrics, and links. Restore validates a complete backup and requires an explicit replacement action. Download a backup before plan revisions. To apply an agreed coaching change, edit a downloaded backup's plan while preserving session IDs and restore it after review; Garmin import alone never alters prescribed workouts.

Initial local migration includes 15 available activities and all seven legacy completions. Six older records from an earlier export are unavailable and can be merged later from a fuller export. Browser-only drafts in the old tracker are outside its saved `progress.json`; export them from the old tracker if present before retiring it.
