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
   OWNER_EMAIL="your-approved-google-address"
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

Use the activity-overview export, with headers `Activity Type`, `Date`, `Title`, `Distance`, and `Time`. Other columns are retained; order is irrelevant. UTF-8, BOM, comma delimiters, quoted commas/newlines, doubled quotes, CRLF/LF, fractional lap durations, thousands separators, `--` missing metrics, and apostrophe-prefixed negative elevation are handled. Individual lap/interval exports lack activity identity and are rejected.

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

## Cloudflare production setup

Existing GitHub `main` integration publishes to `ogori-training-plan.pages.dev`. Keep build command `npm run build`, output `dist`, and Node 24.15+. Do not push a release before private access and storage are configured.

1. Refresh Wrangler authentication (`npx wrangler login`). Create a production D1 database and a separate preview database. Replace the placeholder `database_id` and `preview_database_id` in `wrangler.jsonc`; database IDs are configuration, not credentials.
2. Apply `migrations/0001_state.sql` remotely and seed the production database from `.private/seed.sql`. The one-time seed cannot overwrite an existing state record. Provision the preview schema separately. Keep preview test changes separate from production history.
3. In Cloudflare Zero Trust, configure Google as the identity provider (personal Google accounts work). Google requires a Google Cloud OAuth client; keep its client secret in Cloudflare's identity-provider configuration. Do not place it in Git or this frontend.
4. Protect **both production and preview URLs**, using Cloudflare's [production pages.dev instructions](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain). The ordinary Pages access-policy toggle initially protects previews only. Editing that application's wildcard to the exact production hostname and re-enabling preview protection creates separate production and preview policies. Check both, including historical deployment URLs.
5. Restrict each Access application to the single approved Google email. Enable only Google and “Apply instant authentication” to skip the identity-provider chooser. Set application/policy session duration to one month; Google can still require reauthentication.
6. Set Pages Functions environment variables separately for production and previews:

   | Variable             | Value                                                  |
   | -------------------- | ------------------------------------------------------ |
   | `OWNER_EMAIL`        | Exact approved Google email                            |
   | `ACCESS_TEAM_DOMAIN` | Team hostname, e.g. `your-team.cloudflareaccess.com`   |
   | `ACCESS_AUD`         | Audience tag for that environment's Access application |

   API requests require a valid signed Access JWT with the configured issuer/audience and owner email. Missing configuration fails closed. Never configure a production authentication bypass.

7. Verify an unauthenticated browser reaches Google sign-in, an unapproved account cannot enter, and `/api/state` never exposes data without valid authorization. Verify approved-account sync on phone and computer, then release through GitHub `main`.

The repository contains no imported CSVs, progress files, seed data, or credentials. `.private`, `.wrangler`, `.dev.vars`, and local environment files are ignored. Static assets contain the interface only; personal records are loaded from the authenticated API. API and static responses request no caching; no service worker or offline queue exists.

## Persistence and recovery

D1 stores one versioned JSON document. Writes use a revision check and atomic conditional update. A stale device receives the latest saved state and an explicit conflict; it cannot silently overwrite another device. Notes remain in the current tab until saved, with visible errors and retry. There is no offline persistence: keep the tab open if a save fails.

Your data → Download backup saves the plan, every progress record, imported raw metrics, and links. Restore validates a complete backup and requires an explicit replacement action. Download a backup before plan revisions. To apply an agreed coaching change, edit a downloaded backup's plan while preserving session IDs and restore it after review; Garmin import alone never alters prescribed workouts.

Initial local migration includes 15 available activities and all seven legacy completions. Six older records from an earlier export are unavailable and can be merged later from a fuller export. Browser-only drafts in the old tracker are outside its saved `progress.json`; export them from the old tracker if present before retiring it.
