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

## Fixed: "PTO - Unknown" on the shared calendar (0007_employee_names_view.sql) ✅ verified

- [x] Root cause: `pto_requests` embedded `profiles(full_name)` directly, but `profiles`' own RLS only lets a non-admin see their own row - every other employee's name silently resolved to null. Fixed with a narrow `employee_names` view (id + full_name only, nothing sensitive) that `useTeamPto` now queries separately and merges client-side instead of relying on the embed.
- [x] Re-verified on the calendar: all three test accounts' names ("Ryan Thomas", "Test Employee", "Brian Pitre") resolve correctly, including inside the day-detail modal, with no console errors.

## Admin Timesheets grouped by employee ✅ verified

- [x] `/admin/timesheets` now groups entries under a numbered `.section-head` per employee (alphabetical by name), each with its own hours subtotal tag and its own table, instead of one flat table with a repeated Employee column.
- [x] Verified live with three employees in range: Brian Pitre (0.00 hrs, still clocked in), Chris Wiles (0.08 hrs), Ryan Thomas (12.62 hrs, including self-edited/admin-edited rows with notes) - all correctly separated, edit links still work per row, no console errors.

## Manual time entry removed for non-admin employees (0008_remove_employee_manual_time_entry.sql)

- [x] `/timesheet` no longer shows "+ Add Entry" or an "Edit" link on any row - employees can only clock in/out live. Historical rows still show "EDITED" (their own past self-edit) vs "EDITED BY ADMIN" correctly via `source`.
- [x] `/timesheet/entries/new` and `/timesheet/entries/:id` routes removed entirely; navigating there directly renders nothing (same as any other unmatched route in this app - no catch-all/404 page exists yet).
- [x] `/admin/entries/new` still works unchanged - employee picker, no date-window restriction, reason still required.
- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean after removing `TimeEntryForm`'s `mode` prop and the now-dead `daysAgo` helper.
- [ ] **RLS check (not yet run against the live project)**: as a non-admin, `insert into time_entries (employee_id, clock_in, source) values (auth.uid(), now() - interval '1 day', 'self')` must be rejected (backdated self-insert, outside the 5-minute live-clock-in window).
- [ ] **RLS check (not yet run)**: as a non-admin, `update time_entries set clock_in = clock_in - interval '1 hour' where id = <your own open entry>` must be rejected by the `time_entries_prevent_self_backdating` trigger.
- [ ] **RLS check (not yet run)**: as a non-admin, clocking out via `update ... set clock_out = now(), edit_reason = 'test' where id = <your own open entry>` must be rejected (edit_reason no longer allowed on the self clock-out path).

## Employee timesheet grouped by day with per-day totals ✅ verified

- [x] `/timesheet`'s entry list now groups rows under a numbered `.section-head` per calendar day (most recent first), each with its own hours subtotal tag and its own table (mirrors the same grouping pattern used on the admin Timesheets page, grouped by day instead of by employee). Date column removed from the row table since it's now the group header.
- [x] Verified live: day totals (8.22 / 2.18 / 8.00 / 4.50) match exactly what the Today/Current Pay Period/Last 30 Days KPI cards above compute independently. Checked at mobile width (375px), no horizontal scroll, no console errors on a fresh tab.

## Employee timesheet cards: Today / Current Pay Period / Last 30 Days ✅ verified

- [x] `/timesheet` shows three `.kpis` cards - Today, Current Pay Period, Last 30 Days (superseding the earlier Last 7/30/60 Days version) - computed client-side off the same 60-day fetch `useTimesheet` already does, no extra query. "Current Pay Period" uses the new `getCurrentPayPeriodRange` in `src/lib/payroll.ts`, sharing the same anchor/period-length constants as the payday math so the two stay consistent.
- [x] Verified live with real mixed-period test data: Today correctly summed only today's closed entries (8.22, excluding the still-open "1:16 AM - now" row); Current Pay Period correctly summed today + the rest of the current 14-day period (10.40) while excluding two entries from the prior period (Aug 20/22); Last 30 Days correctly summed everything including those prior-period entries (22.90). Hand-verified the arithmetic against the visible row list.
- [x] Checked at mobile width (375px) - cards wrap with no page-level horizontal scroll (`document.documentElement.scrollWidth === window.innerWidth`), no console errors on a fresh tab.

## Hourly overtime push alerts (0010_overtime_alerts.sql + send-overtime-alerts Edge Function) ✅ verified live in production

- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean. Confirmed the generated `dist/sw.js` correctly injects `importScripts("/push-sw.js")` ahead of precaching, and that `public/push-sw.js` is reachable and unmodified at `/push-sw.js`.
- [x] Verified via `npm run preview` (dev mode has PWA disabled, same caveat as the rest of Phase 6): service worker registers and activates with no console errors either origin (5173 dev session, 5174 preview build).
- [x] `Overtime Alerts` card only renders for hourly employees (`profile.pay_type === 'hourly'`) on `/`.
- [x] With notification permission denied, the card correctly shows the blocked-permission message and no button, instead of a broken/silently-failing toggle.
- [x] Deployed end-to-end on the real project: migration applied, Edge Function deployed with all 4 secrets (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`/`CRON_SECRET`) set correctly, `overtime-alert-check` cron job scheduled every 15 minutes (with the `apikey` header the Supabase gateway requires in addition to the JWT-verification toggle - not obvious up front, cost a few rounds of 401s to find), `VITE_VAPID_PUBLIC_KEY` baked into the Vercel production build (confirmed present in the built JS bundle).
- [x] **Real device test passed**: enabled on a real laptop browser, confirmed a genuine `push_subscriptions` row was saved (real FCM endpoint). Fast-tested delivery by using an employee who was already 9+ hours into an open punch and invoking the Edge Function directly - `notified: 1`, and the push notification ("Bottoms Up Time Clock - Are you authorized to be working overtime?") actually arrived on the laptop.
- [x] Confirmed the 2-hour resend throttle works: calling the function again immediately after a successful send correctly returned `due: 0` (no duplicate push), rather than re-notifying on every 15-minute cron tick.
- [ ] Not yet observed: the stale-subscription cleanup path (404/410 on send) and the annual/multi-day repeat-while-still-clocked-in behavior past the second alert, both low-risk/straightforward given the core send path is confirmed working.

## Salaried employees can now use the Clock tab ✅ verified

- [x] Removed the pay-type gate on `/` (`ClockPage.tsx`) - previously salaried employees saw "You're on salary, so there's no clock to punch" instead of the clock button. Now every employee, hourly or salaried, gets the same Clock In/Out button, status card, and This Week progress. This was purely a UI restriction - no RLS or DB constraint on `time_entries` ever referenced `pay_type`, so nothing needed to change at the database layer.
- [x] Nav bar's `/` link now always reads "Clock" (was "Home" for salaried, "Clock" for hourly).
- [x] Re-verified the hourly account still clocks in/out with no regressions after the change (same code path both pay types now share). Not separately re-tested with a salaried login in this pass, but the branch that used to special-case salaried no longer exists - there is no longer a different code path to diverge.

## Clock in/out geolocation (0009_time_entry_geolocation.sql) ✅ verified

- [x] Clock In / Clock Out capture best-effort device location (`src/lib/geolocation.ts`) and save it to the new `clock_in_lat/lng/accuracy_m` and `clock_out_lat/lng/accuracy_m` columns - never blocks the punch itself, and resolves to null within 6s if permission is denied/unavailable/slow.
- [x] Verified with location denied/unsupported (the default in this sandboxed test browser): clock in and clock out both completed instantly with no error, no console errors, columns saved null.
- [x] Verified with a simulated granted location (overrode `navigator.geolocation.getCurrentPosition` to return a fixed coordinate): both clock-in and clock-out rows saved lat/lng correctly.
- [x] Admin-only visibility confirmed: `/admin/timesheets` shows a small orange "map" link (`https://www.google.com/maps?q=lat,lng`) next to any clock-in/out time that has a location, opening in a new tab; rows without one show nothing extra. `/timesheet` (the employee's own view) never shows a map link or the raw coordinates, by design.
- [ ] Not yet tested on a real phone: actual permission-prompt UX (first-time "Allow location?" browser dialog) and real GPS accuracy.

## Change password (new `/account` page) ✅ verified

- [x] Clicking your own name in the top nav (any role) now opens `/account` instead of being plain text; it also highlights orange like other active nav links.
- [x] Change Password form requires current password, new password (min 8 chars), and a matching confirmation, all client-side validated before any network call.
- [x] Submitting re-verifies the current password via `signInWithPassword` before calling `supabase.auth.updateUser({ password })`, so someone at an unlocked/shared device can't change a password without knowing the existing one.
- [x] Verified live: mismatched new/confirm shows "New password and confirmation do not match." without any network call; a wrong current password shows "Current password is incorrect." and confirmed the existing session stays fully intact afterward (re-checked by navigating to `/`, still signed in, no console errors).
- [ ] Not yet run: full happy-path test with a real correct current password (didn't want to actually rotate a live account's password during this pass) - confirm success message shows and the new password actually signs in afterward.

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
