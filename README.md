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

`/` shows a month calendar (`src/components/MonthCalendar.tsx`) for every employee with three event types: **paydays** (pure client-side arithmetic in `src/lib/payroll.ts` - the Friday following each 2-week pay period, anchored to 2026-08-23, no DB table involved), **holidays** (admin-managed at `/admin/holidays`, visible to everyone), and **approved PTO/sick time for the whole team** (a "who's out" view - `pto_requests_select_approved_all` in `0006_holidays_and_calendar.sql` additively widens visibility for approved rows only; pending/denied requests still stay private to the owner + admin).

## Approval workflow

Only PTO requests go through admin approval (`pto_requests.status` + `review_pto_request`). Time entries do not - employees clock in/out live and can also add or correct their own entries from the last 14 days (a reason is required for any manual add/edit). Admins can still browse and correct any employee's entries at any time from **Timesheets** (`/admin/timesheets`), just without an approve step.

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
