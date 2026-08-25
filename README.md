# Bottoms Up Time Clock

Time clock / hours-tracking web app for Bottoms Up employees (hourly + salaried), built as an installable PWA. See the implementation plan for full context on requirements and architecture.

**Live**: https://bottoms-up-time-clock.vercel.app - deployed on Vercel, auto-deploys on every push to `main` (GitHub repo: `rthomasBU/bottoms-up-time-clock`).

## Branding

Styled to the Bottoms Up house web style guide (black topbar, orange/black/gray palette, Saira Semi Condensed uppercase headings, light theme only). Class names in `src/index.css` match the guide exactly so this app pattern-matches with the rest of the internal tool suite. The logo lives at `public/logo.png`; do not recolor, stretch, or crop it. Helvetica Neue is referenced by name only in the CSS font stack and must never be bundled as a font file (no license held for it) - Windows falls back to Arial, which is expected.

## Stack

- React + TypeScript + Vite
- Supabase (Postgres + Auth + Row Level Security) as the backend
- Deployed as a PWA (installable on phones via "Add to Home Screen") - no separate native app

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) if you haven't already.
2. **Env vars**: copy `.env.example` to `.env.local` and fill in your project's URL + anon key (Project Settings → API in the Supabase dashboard):
   ```bash
   cp .env.example .env.local
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Link the CLI to your cloud project** (needed to push migrations and generate types without Docker/local Postgres):
   ```bash
   npm run db:link
   ```
   This will prompt for your project ref (from the dashboard URL, `supabase.com/dashboard/project/<ref>`) and your database password.
5. **Push the schema + RLS policies**:
   ```bash
   npm run db:push
   ```
   This applies everything in `supabase/migrations/` to your cloud project.
6. **Regenerate typed schema** (optional but recommended after any migration change - `src/lib/database.types.ts` is hand-written to match the migrations until this is run):
   ```bash
   npm run gen:types
   ```
7. **Run the app**:
   ```bash
   npm run dev
   ```

## PTO accrual

Every active employee's `pto_balance_hours` accrues automatically via a daily `pg_cron` job (`public.run_daily_pto_accrual`, `supabase/migrations/0005_pto_accrual.sql`): +40 hours every January 1st (added on top of whatever's left, no reset), plus 80 hours/year split into 26 biweekly installments (~3.08 hours every 2 weeks), anchored to the pay period starting 2026-08-24. `pto_accrual_log` makes each day's accrual idempotent so a cron retry can't double-apply it. This does not backfill anything before that anchor date - balances up to now were set manually.

## Home-page calendar

`/` shows a month calendar (`src/components/MonthCalendar.tsx`) for every employee with three event types: **paydays** (pure client-side arithmetic in `src/lib/payroll.ts` - the Friday following each 2-week pay period, anchored to 2026-08-23, no DB table involved), **holidays** (admin-managed at `/admin/holidays`, visible to everyone - can add/edit/remove one at a time, or one-click add the current or next year's 11 U.S. federal holidays via `src/lib/federalHolidays.ts`, which computes the correct date each year rather than hardcoding one), and **approved PTO/sick time for the whole team** (a "who's out" view - `pto_requests_select_approved_all` in `0006_holidays_and_calendar.sql` additively widens visibility for approved rows only; pending/denied requests still stay private to the owner + admin).

## Approval workflow

Only PTO requests go through admin approval (`pto_requests.status` + `review_pto_request`). Time entries do not - employees clock in/out live only, with no self-service add or edit (removed in `0008_remove_employee_manual_time_entry.sql`; a DB trigger blocks any non-admin change to `clock_in` on a `self`-sourced entry, on top of the narrower RLS policies, so this holds even against a direct API call). Admins can add or correct any employee's entries at any time from **Timesheets** (`/admin/timesheets`), with a required reason for the record.

## Hourly overtime push alerts

Hourly employees can opt in (per-device, "Overtime Alerts" card on `/`) to a push notification - "Are you authorized to be working overtime?" - the first time they're clocked in past 8 hours on a single punch, repeating every 2 hours after that for as long as they stay clocked in. Salaried employees never get this (`profiles.pay_type === 'hourly'` filter, checked server-side by the sender, not just hidden client-side).

This is the one part of the app that isn't just a SQL migration - Web Push needs a server to sign and send each message (VAPID), which Postgres can't do alone. The pieces:
- `push_subscriptions` table + `time_entries.last_overtime_notified_at` (`0010_overtime_alerts.sql`) - no secrets, safe to run like any other migration.
- `supabase/functions/send-overtime-alerts` - a Deno Edge Function, checked every 15 minutes by pg_cron + pg_net, that finds hourly employees due for an alert and sends via `npm:web-push`. Deployed and configured separately - see the one-time setup checklist (not a SQL-editor paste).
- `src/lib/push.ts` / `src/components/OvertimeAlertsToggle.tsx` - client-side subscribe/unsubscribe, one row per device.
- `public/push-sw.js` - the service worker's `push`/`notificationclick` handlers, spliced into the generated Workbox service worker via `workbox.importScripts` (`vite.config.ts`) rather than switching the whole PWA to a hand-written service worker.

## Clock-in/out geolocation

Every live clock in/out captures a best-effort device location via the browser Geolocation API (`src/lib/geolocation.ts`), saved to `clock_in_lat/lng/accuracy_m` and `clock_out_lat/lng/accuracy_m` (`0009_time_entry_geolocation.sql`). It's always optional - a denied, unsupported, or slow (>6s) location never blocks the punch, it just saves as null. Admins see a "map" link next to any clock in/out that has a location on **Timesheets** (`/admin/timesheets`); employees don't see it on their own `/timesheet`. Manual admin entries never carry a location (they aren't a real device capture).

## Travel days (per diem)

Any employee (hourly or salaried - unlike the overtime alert, this isn't tied to pay type) can log the days they traveled for work from its own **Travel** tab (`/travel`, `src/routes/employee/TravelPage.tsx` wrapping `src/components/TravelDayLogger.tsx`), so payroll knows which days to add a flat per diem allowance for. Logging works over a start-end date range in one go - each date in the range still becomes its own row (`useTravelDays.logTravelDays` upserts with `ignoreDuplicates`, so a date that's already logged is silently skipped rather than failing the whole range; the form reports back how many were newly logged vs already existed). No dollar amount is stored - like hours, the actual payroll math happens manually outside the app. Self-logging is limited to the last 14 days, can't be future-dated, and one row per employee per date (`0011_travel_days.sql`); an employee can remove their own within that same 14-day window. Days logged in the selected export range feed the `Pay/Per Diem/Units` column of the GRIN payroll export (see below) - there's no separate travel-days export or on-screen list anymore.

## Tech support days

Any employee can log the days they spent on tech support from its own **Tech Support** tab (`/tech-support`, `src/routes/employee/TechSupportPage.tsx` wrapping `src/components/TechSupportDayLogger.tsx`), so payroll knows which days to add pay for. Same format as Travel days above - deliberately identical shape, same file down to the RLS policies (`0014_tech_support_days.sql`, self-logging limited to the last 14 days, no future-dating, one row per employee per date, self-removable within that same window) and the same start-end date-range logging UI. Days logged in the selected export range feed the `Pay/Tech Support/Units` column of the GRIN payroll export.

## Payroll export (GRIN format)

**Export** (`/admin/export`) is a single-purpose page now - a Pay Period picker (`getPayPeriodRangeByOffset` in `src/lib/payroll.ts` - next period through 11 periods back, current selected by default) + employee filter, an "Export Payroll (GRIN Format)" button, and a live preview table showing exactly what that download will contain (built from the same `buildPayrollExportRows` function the actual `.xlsx` writer uses, so the preview can't drift out of sync with the real file). Picking a whole pay period rather than free-form dates guarantees the range always covers whole weeks, which the overtime split below depends on. It generates a `.xlsx` matching GRIN's own ExcelTimeClock import template exactly (`src/lib/payrollExport.ts`) - one row per employee, columns `EmployeeID, FirstName, LastName, Dept, Locn, Job, Shift, Pay/Hourly/Units, Pay/Overtime/Units, Pay/Salary/Units, Pay/Bonus/Units, Pay/Tech Support/Units, Pay/PTO/Units, Pay/Holiday/Units, Pay/Per Diem/Units`. What each column pulls from:

- **EmployeeID** - `profiles.payroll_id` (`0012_payroll_id.sql`), an admin-set free-text field with no in-app editor yet - set it via Supabase Table Editor -> profiles -> payroll_id. Blank until set.
- **FirstName/LastName** - split from `profiles.full_name` on the first space; a name with more than two parts puts everything after the first word into LastName.
- **Dept** - `"Hourly"` or `"Salary"` from `profiles.pay_type`.
- **Locn** - always `"Default Location"` (the only value the template itself ever uses); **Job** - always blank; **Shift** - always `1`.
- **Pay/Hourly/Units** and **Pay/Overtime/Units** - hourly employees only, split per Monday-Sunday workweek from the selected pay period's closed time entries (hours over 40 in a week -> Overtime, the rest -> Hourly). Exact because the Pay Period picker only offers whole periods (always whole weeks), never a partial range.
- **Pay/Salary/Units** - `"1"` for salaried employees (a flat "paid this period" signal - the real salary amount lives in GRIN), blank for hourly.
- **Pay/PTO/Units** - approved PTO/sick hours overlapping the range, from the same `useTeamPto` hook the Calendar uses; combines both request types since the template has no separate sick column.
- **Pay/Per Diem/Units** - count of logged travel days in the range for that employee.
- **Pay/Tech Support/Units** - count of logged tech support days in the range for that employee.
- **Pay/Bonus/Units**, **Pay/Holiday/Units** - always blank; nothing in this app produces that data.

Every active employee is included regardless of whether they have any hours/PTO/travel in range, matching the template always listing the full roster. The `xlsx` (SheetJS) library is dynamic-imported only when this export is actually clicked and excluded from the PWA precache (`vite.config.ts` `globIgnores`), so its ~500KB never reaches an employee's phone just for clocking in/out. Installed from SheetJS's own CDN (`npm install https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`) rather than the `xlsx` npm registry package, which is stuck on an old release with known vulnerabilities the maintainer stopped patching there.

## Creating employee accounts

There is no public signup - an admin creates each employee's login. Easiest path for 10-15 people: Supabase Dashboard → **Authentication → Users → Add user** (set an email + temp password, or send an invite email). A `profiles` row is auto-created for each new user (via a DB trigger); then set that employee's `role` (`employee`/`admin`) and `pay_type` (`hourly`/`salaried`) either in **Table Editor → profiles**, or via a small admin screen once one exists in the app.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server (PWA features inactive - Vite only enables them in production builds) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build locally, to test PWA install/service worker |
| `npm run typecheck` | Typecheck only |
| `npm run lint` | Lint (oxlint) |
| `npm run db:link` | Link CLI to your cloud Supabase project |
| `npm run db:push` | Push local migrations to the linked project |
| `npm run gen:types` | Regenerate `src/lib/database.types.ts` from the live schema |
| `npm run icons:generate` | Regenerate PWA icons from `public/logo.png` |

## Status

See [TESTING.md](./TESTING.md) for the manual verification checklist, kept up to date per build phase.

- [x] Phase 0 - project scaffold
- [x] Phase 1 - auth + basic clock in/out
- [x] Phase 2 - timesheet history + admin dashboard
- [x] Phase 3 - manual entry editing (originally shipped with admin approval; approval was later removed for time entries, see below)
- [x] Phase 4 - PTO tracking
- [x] Phase 5 - export (CSV/PDF)
- [x] Phase 6 - PWA polish (installability, icons, offline handling)

All six build phases are complete. Remaining work is real-device install testing (see [TESTING.md](./TESTING.md)) and any polish that surfaces once real employees start using it.
