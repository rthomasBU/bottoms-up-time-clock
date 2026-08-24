# Manual test checklist

No automated test framework yet (see plan - reasonable to add once flows stabilize). Re-run the relevant section after each build phase. Test against the real Supabase cloud project (no local Docker stack in use for this project).

## Setup for testing

Create at least these accounts via the Supabase Dashboard (Authentication → Users → Add user), then set each one's `role`/`pay_type` in Table Editor → `profiles`:

| Email | Role | Pay type |
|---|---|---|
| (you, admin) | admin | hourly |
| a test hourly employee | employee | hourly |
| a test salaried employee | employee | salaried |

## Phase 1 - Auth + basic clock in/out

- [ ] Visiting the app while signed out redirects to `/login`.
- [ ] Logging in with a wrong password shows an error, does not sign in.
- [ ] Logging in with a valid hourly account lands on the Clock page.
- [ ] Clock page shows "clocked out" state initially.
- [ ] Clicking **Clock In** switches to "clocked in" state with a live elapsed timer, persists across a page refresh.
- [ ] Clicking **Clock Out** switches back to "clocked out".
- [ ] Attempting to clock in twice without clocking out first is prevented (button only offers Clock Out while an entry is open).
- [ ] Logging in with a **salaried** account shows the "no clock to punch" message instead of the clock button.
- [ ] "Forgot password?" sends a reset email (check inbox).
- [ ] **RLS check** (Supabase Studio SQL editor): as employee A, querying `time_entries` only returns rows where `employee_id = A`; cannot see employee B's rows.
- [ ] Sign out returns to `/login` and blocks access to `/` again.

## Phase 2 - Timesheet history + admin dashboard ✅ verified

- [x] Employee timesheet history groups entries by day with correct per-day and period totals.
- [x] Admin dashboard shows accurate "currently clocked in" list and pending-approval count.
- [x] `/admin` redirects non-admins back to `/` (RLS/RoleGuard both enforce this - checked via direct URL nav).

## Phase 3 - Manual entry editing (superseded, see below) ✅ verified

- [x] Manually adding an entry (`+ Add entry`) requires an edit reason, saves with `source = admin_manual`, and shows the `MANUAL` badge.
- [x] Editing an existing entry loads its current values (edit reason field itself is left blank, requiring a fresh note each edit).

## Approval removed from time entries; self-service entry added ✅ verified

- [x] Employee: clock in/out still requires no reason and works as before.
- [x] Employee: `+ Add Entry` on `/timesheet` creates a manual entry for themselves, requires a reason, saves with `source = self`.
- [x] Employee: `Edit` link edits an existing entry (open or closed), requires a reason, persists correctly.
- [x] Admin: `/admin/timesheets` lists all entries with date/employee filters, no approve step, shows `SELF-EDITED` vs `ADMIN-EDITED` with the reason note, and an `Edit` link that works on any entry.
- [x] Admin: Dashboard's "PTO Awaiting Approval" KPI reflects the real pending PTO count and links to `/admin/pto`.
- [x] Export: no more Approved/Pending filter; Type column shows Live vs Manual correctly.
- [ ] RLS check (not yet run): an employee editing/inserting a `time_entries` row with `clock_in` older than 14 days is rejected (the UI already blocks it via the `min` date attribute, but worth confirming directly in the Supabase SQL editor as that employee).
- [ ] RLS check (not yet run): an employee cannot set `edited_by` to someone else's id, or omit `edit_reason`, on a manual edit.

## PTO accrual (0005_pto_accrual.sql)

- [ ] `select cron.job` in the Supabase SQL editor shows the `pto-accrual-daily` job scheduled.
- [ ] Manually run `select public.run_daily_pto_accrual();` once - if today happens to be an accrual day it applies once; running it again immediately after must NOT double-apply (check `pto_accrual_log` has exactly one row for today per kind, and balances only moved once).
- [ ] Spot-check the math: an active employee's `pto_balance_hours` increases by ~3.08 on an accrual day, and inactive employees are skipped.
- [ ] On January 1st (or by temporarily testing with a manually-inserted `pto_accrual_log` row deleted and the function's anchor logic reasoned through), confirm the annual +40 grant adds to the existing balance rather than resetting it.

## Home-page calendar (0006_holidays_and_calendar.sql) ✅ verified

- [x] Calendar on `/` shows paydays (green), holidays (gray), and approved PTO (gold) with correct dates.
- [x] Prev/Next month navigation works and paydays continue the correct 14-day cadence across months.
- [x] Admin can add a holiday on `/admin/holidays`; it appears on the calendar and in the holidays list.
- [x] Salaried employees have a working "Home" nav link to `/` (previously missing entirely).
- [x] Fixed: the calendar's `min-width: 490px` grid was bleeding out to cause real page-level horizontal scroll at 390px width, not just its own internal scroll - fixed with `width: 100%` on `.calendar`/`.calendar-scroll` so the `overflow-x: auto` wrapper has a definite width to actually clip against. Re-verified clean after the fix (`document.documentElement.scrollWidth === window.innerWidth`, calendar's own scroll still works).
- [x] Confirmed with real second/third employee accounts in production: approved PTO from other employees (e.g. "PTO - Test Employee", "PTO - Brian Pitre") shows correctly on the shared calendar with their names.

## Calendar moved to its own tab; week progress + expandable day added ✅ verified

- [x] Calendar moved off the home page to its own `/calendar` route and nav tab; home page (`/`) now shows a "This Week" hours-vs-40hr-target progress card (hourly employees only) instead.
- [x] Clicking any calendar day opens a modal listing every event for that day in full, even ones the cell itself doesn't have room to show.
- [x] Day cells cap at 2 visible event tags with a "+N more" indicator when there are more; the modal always shows the complete list (tested a day with 3 events).
- [x] Modal closes via its Close button, clicking the backdrop, or Escape.
- [x] Day cells have an accessible name (e.g. "Tuesday, September 1, 2026, 3 events") - previously the 42 day cells had no accessible label at all.
- [x] No horizontal page scroll and the modal fits comfortably at 390x844.

## Phase 4 - PTO tracking ✅ verified

- [x] Submitting a request shows it as `pending` in "Your requests" with correct dates (watch for timezone bugs on `date`-only columns - fixed once, worth re-checking after any date-formatting change).
- [x] Admin can approve/deny from `/admin/pto`; approving calls the `review_pto_request` RPC, which atomically updates status and decrements `profiles.pto_balance_hours`.
- [x] The employee's balance display refreshes on navigating to `/pto` (not just on a hard reload) after an admin approves elsewhere.
- [ ] RLS check: a second admin cannot double-approve an already-reviewed request (RPC raises "already been reviewed").
- [ ] Employee can cancel their own pending request; cannot cancel one that's already approved/denied.

## Phase 5 - Export (status filter later removed, see above) ✅ verified

- [x] CSV downloads and correctly quotes fields containing commas (e.g. formatted dates).
- [x] "Export PDF (print)" opens the browser print dialog with nav/filters hidden via print CSS.

## Phase 6 - PWA polish ✅ built, needs real-device testing

- [x] Manifest, icons (192/512 + maskable), and service worker all verified present and loading correctly (via `npm run preview`, since dev mode has PWA features disabled).
- [x] `apple-touch-icon` link present for iOS home-screen icon.
- [ ] **Real-device test needed**: install on an actual Android phone (Chrome menu → "Install app" or the in-app install banner) and an actual iPhone (Safari → Share → Add to Home Screen) - confirm the icon, splash/theme color, and standalone (no browser chrome) display all look right.
- [ ] Lighthouse PWA audit (Chrome DevTools → Lighthouse) on the deployed production URL once hosted.
- [ ] Confirm a clock in/out attempt while offline shows a clear error rather than hanging or silently failing.
