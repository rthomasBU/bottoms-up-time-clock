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

## Federal holiday bulk-add + editable holidays (0013_holidays_update.sql) ✅ verified live

- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean.
- [x] New "Add Federal Holidays" card on `/admin/holidays` - year selector (current + next year) and a button that computes and inserts the standard 11 U.S. federal holidays for that year (`src/lib/federalHolidays.ts`), using upsert + `ignoreDuplicates` on the existing `holiday_date` unique constraint so a date the admin already added manually (or a previous federal-holiday add) is silently skipped rather than erroring, and reports back "Added N (M already on the list, skipped)".
- [x] **Date math independently verified**: computed values matched known-correct 2026 dates I checked by hand before ever running it (MLK Day Jan 19, Memorial Day May 25, Thanksgiving Nov 26) - and matched a real pre-existing row in the live data (Labor Day Sep 7, 2026, entered manually before this feature existed), which the bulk-add correctly recognized as a duplicate and skipped instead of creating a second Labor Day row.
- [x] Verified live: clicked "Add Federal Holidays" for 2026 with one pre-existing holiday (Labor Day) already in the list - got "Added 10 federal holidays for 2026 (1 already on the list, skipped)", and all 11 then appeared correctly in the table.
- [x] Confirmed newly-added federal holidays actually show up on the shared Calendar (`/calendar`) - Labor Day tag visible on Sep 7, 2026, same as before (this path was already working, just now has real data flowing through it from the bulk-add).
- [x] Holidays are now editable - clicking "Edit" on a row populates the same add/edit form (name + date) and swaps the button to "Save Changes" + "Cancel", matching the add/edit-in-one-form pattern used elsewhere in the app (`TimeEntryForm`).
- [x] **Found and fixed a real bug while testing**: before adding the `holidays_update_admin` RLS policy, clicking "Save Changes" appeared to succeed (form reset, no error) but silently changed nothing - Postgres RLS blocks an UPDATE with no matching policy by filtering it to zero affected rows rather than raising a permission error, and the original `update()`/`remove()` calls didn't check whether any row actually came back. Fixed by adding `.select('id')` to both and treating an empty result as a real error ("Couldn't save - you may not have permission to edit holidays."), verified: pre-migration, editing now correctly shows that error and leaves the form open instead of silently discarding the edit.
- [x] No console errors on a fresh tab, no horizontal scroll at mobile width (375px).
- [ ] Not yet re-verified post-migration (the fix above was verified against the *failure* path; once `0013_holidays_update.sql` is applied, worth confirming a real edit persists and the success path - form resets, no error, table shows the new name/date - still works correctly too).

## Travel moved to its own tab ✅ verified live

- [x] New `/travel` route + "Travel" nav link (between Calendar and PTO), rendering a dedicated `TravelPage.tsx` (h1 + sub, matching Calendar/PTO's page pattern) wrapping the same `TravelDayLogger` component - removed from the Clock tab entirely, no longer sharing space with Overtime Alerts there.
- [x] Trimmed `TravelDayLogger`'s own internal card label/hint since they're now redundant with the page's h1/sub (matches the convention already used by `PtoPage`, where the request form doesn't repeat its own heading either).
- [x] Verified live: Clock tab now goes straight from "This Week" to "Overtime Alerts" with no Travel card in between; `/travel` shows the full logger (form + existing logged days) under its own heading, no duplicate headings.
- [x] No console errors on a fresh tab, no horizontal scroll at mobile width (375px), form and list both render cleanly stacked at 375px.

## Export "Hours" section aggregated to one row per employee ✅ verified live

- [x] `/admin/export`'s Hours section (section 2) now shows `Employee | Total Hours` - one row per visible employee (still lists everyone, 0.00 for no hours in range, matching the roster-always-shown pattern elsewhere), instead of one row per individual clock in/out entry with Date/Clock In/Clock Out/Type columns. Both the on-screen table and the CSV export changed the same way; "Export PDF (Print)" is unaffected code-wise, it just prints whatever's now on screen.
- [x] Verified live: 10 employees listed, Ryan Thomas 10.40 + Chris Wiles 0.08 = 10.48, matching the summary hint above the table exactly. Confirmed the CSV export's actual content (intercepted the Blob passed to `URL.createObjectURL` and read its text directly, since the download helper revokes the blob URL synchronously right after the click - a plain post-click fetch was too late) - `employee,hours` header, same 10 rows, same values as the table.
- [x] No console errors on a fresh tab, no horizontal scroll at mobile width (375px).

## Export page simplified to payroll preview only ✅ verified live

- [x] Removed the "Hours" (section 2) and "Travel Days" (section 3) sections from `/admin/export` entirely, along with their CSV export buttons and the "Export PDF (Print)" button - the page is now just the filter row plus the single "Payroll Import (GRIN)" section (unnumbered now that it's the only section).
- [x] Added a live preview table under the export button showing exactly what the `.xlsx` download will contain - same 15 GRIN columns, one row per visible employee - built by calling `buildPayrollExportRows` directly (the same function `downloadPayrollExportXlsx` uses), so the preview can never drift out of sync with the real export; changing the date range or Employee filter updates the preview immediately, no separate "generate preview" step.
- [x] Verified live: preview table matches the values already independently confirmed for the GRIN `.xlsx` export (Ryan Thomas `Pay/Hourly/Units: 10.40`, `Pay/PTO/Units: 8.00`; salaried employees show `Pay/Salary/Units: 1`; all 10 employees listed).
- [x] Wide 15-column table scrolls horizontally inside its own `.tablewrap` container at both desktop and mobile (375px) width - confirmed no page-level horizontal scroll either width.
- [x] No console errors on a fresh tab (a second, pre-existing tab's console history had stale Vite HMR errors referencing removed code from earlier in the session - confirmed those don't reproduce on a fresh navigation, per the established stale-HMR pattern).
- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean.

## Tech Support day logging (0014_tech_support_days.sql)

- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean.
- [x] New "Tech Support" nav link (between Travel and PTO) -> `/tech-support`, rendering `TechSupportPage.tsx` wrapping `TechSupportDayLogger.tsx` - deliberately built as a straight copy of the Travel feature's shape (same table structure, same RLS policies down to the 14-day self-edit/delete window, same start/end date-range logging form with upsert+ignoreDuplicates, same list-with-Remove-link display) since the user asked for "same format as travel tab".
- [x] Renamed the shared list styling from `.travel-day-list` to `.logged-day-list` in `index.css` since it's now used by two unrelated features - re-verified Travel's own list still renders identically after the rename.
- [x] Feeds the previously-always-blank `Pay/Tech Support/Units` column of the GRIN payroll export - `buildPayrollExportRows` now takes a 5th `techSupportDays` argument and counts logged days per employee in range, same pattern as travel days -> `Pay/Per Diem/Units`.
- [x] Verified live (pre-migration, table doesn't exist yet): `/tech-support` renders the full form correctly and surfaces "Could not find the table 'public.tech_support_days' in the schema cache" instead of crashing; `/admin/export` also degrades gracefully - shows the same error inline but the preview table still renders (Tech Support column empty, everything else populated as before).
- [x] Confirmed no page-level horizontal scroll at mobile width (375px) on either page; no uncaught console errors on a fresh tab (the two expected 404s from the not-yet-created table match the on-screen error, not a crash).
- [ ] Not yet verified: the actual logging path (insert/select/delete against the real table) - blocked on the migration below being run.

## Export date range replaced with a Pay Period picker ✅ verified live

- [x] Replaced the free-form From/To date inputs on `/admin/export` with a single "Pay Period" dropdown (`getPayPeriodRangeByOffset` in `src/lib/payroll.ts`) - 13 options, next period through 11 periods back (~6 months), newest first, current period labeled "(Current)" and selected by default. Picking a whole period rather than arbitrary dates makes it impossible to select a partial period, which the GRIN export's weekly overtime split already depended on being true (previously just a default, not enforced).
- [x] Verified live: default selection shows "Aug 24 - Sep 6, 2026 (Current)"; switching to "Aug 10 - Aug 23, 2026" correctly recomputed the preview table with different values for that period (Ryan Thomas 10.40 hrs/8.00 PTO/no per diem -> 12.50 hrs/no PTO/4 per diem), confirming the filters and preview both actually respond to the selection rather than only the label changing.
- [x] Employee filter dropdown is unchanged, still independent of the period selection.
- [x] No console errors on a fresh tab, no horizontal scroll at mobile width (375px).
- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean.

## Payroll export matching GRIN's ExcelTimeClock format (0012_payroll_id.sql) ✅ verified live

- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean. `npm audit` clean (0 vulnerabilities) after installing `xlsx` from SheetJS's own CDN tarball instead of the vulnerable npm-registry release.
- [x] New "Payroll Import (GRIN)" section on `/admin/export` (now section 1, hours renumbered to 2, travel days to 3) with a single `Export Payroll (GRIN Format)` primary button (demoted the old hours "Export CSV" to secondary, since this is now the primary payroll workflow) and a hint calling out how many visible employees are missing a `payroll_id`.
- [x] Default export date range changed from a rolling "last 14 days" to the current pay period (`getPayPeriodRange`) - confirmed live (From/To auto-filled 08/24/2026-09/06/2026) - needed for the overtime weekly split to be exact, since it only sees entries inside the exported range.
- [x] Added `profiles.payroll_id` (admin-only via RLS, no in-app editor yet - Table Editor only) for the EmployeeID column.
- [x] `xlsx` (SheetJS) confirmed dynamic-imported only on click (separate ~493KB chunk, absent from the network log until the button is pressed) and confirmed excluded from the PWA precache manifest (`vite.config.ts` globIgnores) - precache dropped from 14 entries/982KB back to 13/501KB after adding the exclusion.
- [x] **Verified the actual generated file**, not just that a download fired: intercepted the blob before the browser's own download step, re-parsed it with the same SheetJS already loaded on the page, and confirmed via `XLSX.utils.sheet_to_json` - header row byte-for-byte matches the reference `ExcelTimeClock_GRIN_*.xlsx` template's 15 columns in the same order; sheet name follows the same `ExcelTimeClock_GRIN_YYYYMMDD` convention; all 10 active employees listed; Dept/Locn/Job/Shift all correct; salaried employees show `Pay/Salary/Units: "1"` with Hourly/Overtime blank; Ryan Thomas (hourly) showed `Pay/Hourly/Units: "10.40"` matching the figure already independently verified on the Timesheets page for the same pay period, with Overtime correctly blank (under 40 hrs/week); PTO units populated from real approved-PTO data via the already-verified `useTeamPto` hook; Bonus/Tech Support/Holiday blank for everyone.
- [x] Confirmed no page-level horizontal scroll at mobile width (375px), no console errors on a fresh tab.
- [ ] Not yet tested: an actual EmployeeID value once `payroll_id` is set for a real employee (only verified the blank-value path, since no employee had one set during this test).
- [ ] Not yet tested: the overtime split with an employee who's genuinely worked over 40 hours in a single week (no test data crossed that threshold this pass).
- [ ] Not yet confirmed by GRIN itself - this test only proves the file is well-formed OOXML with the right shape/values, not that GRIN's own importer accepts it without complaint.

## Travel renamed + date-range logging + Overtime Alerts moved to the bottom ✅ verified live

- [x] Clock tab card order is now Status → Clock button → This Week → Travel (Per Diem) → Overtime Alerts (was Overtime Alerts before Travel) - a pure JSX reorder in `ClockPage.tsx`, no logic change.
- [x] Renamed "Travel Day (Per Diem)" → "Travel (Per Diem)" and "Log Travel Day" → "Log Travel" throughout the employee-facing card (the admin Export page's "Travel Days (Per Diem)" table heading is unchanged - it's a list of individual day-rows, so the plural still fits there).
- [x] Replaced the single date field with Start date / End date - `useTravelDays.logTravelDays` now builds every date in that inclusive range and `upsert`s them all in one call with `ignoreDuplicates: true` (a pure `INSERT ... ON CONFLICT DO NOTHING`, so only the existing self-insert RLS policy applies, no migration needed), reporting back how many were newly logged vs already existed rather than failing the whole range on one collision.
- [x] **Verified live end-to-end**: logged a 5-day range (Aug 21-25) in one submission - "Logged 5 travel days.", all 5 appeared in the list correctly with notes. Resubmitting the exact same range correctly said "Every date in that range was already logged." (0 logged, treated as an error, not a false success). A partially-overlapping range (Aug 19-21, where 21 was already logged) correctly said "Logged 2 travel days (1 already logged, skipped)." - the skip-count math is right.
- [x] Confirmed all range-logged rows showed up correctly on the admin Export page's Travel Days table and CSV export.
- [x] Cleaned up all test data afterward. No console errors throughout.

## Travel day (per diem) logging (0011_travel_days.sql) ✅ verified live

- [x] `npm run typecheck` / `npm run lint` / `npm run build` all clean.
- [x] New "Travel Day (Per Diem)" card on `/` (Clock tab), for every employee regardless of pay type - date picker (default today, capped to the last 14 days, no future dates), optional notes, "Log Travel Day" button, and a list of the employee's own recently logged days with a "Remove" link (only shown within the 14-day self-delete window).
- [x] Verified the card degraded gracefully *before* the migration was applied (clear "table not found" error under the form, rest of the Clock tab unaffected) - confirmed the fallback actually works, not just assumed.
- [x] **Migration applied** - verified end-to-end against live data:
  - Logged a travel day for today with a note ("Drove to the Cincinnati install job") - appeared immediately in the list below the form.
  - Logging a second travel day for the same date correctly failed with the friendly "You already logged a travel day for that date." message (the `unique (employee_id, travel_date)` constraint surfacing through the mapped 23505 error code, not a raw Postgres error).
  - Clicked Remove - the entry disappeared and the list correctly returned to empty.
  - Admin **Export** page (`/admin/export`) "Travel Days (Per Diem)" section correctly showed the logged day (employee, date, note, "Employee" as logged-by) with its own "Export Travel Days CSV" button, only one primary orange button on the page (the existing hours "Export CSV").
  - No console errors on a fresh tab.
- [ ] Not yet verified: the RLS backdating/future-date window enforcement server-side (UI already blocks both via the date input's min/max, but haven't independently confirmed via a raw API call bypassing the UI, same category of not-yet-independently-verified RLS edge case as a few others in this file).

## Payday tag moved next to the date number ✅ verified

- [x] `MonthCalendar.tsx` now splits payday out of a day's regular event list and renders it inline next to the date number (`.calendar-day-top`), instead of stacked with holidays/PTO below. Identified via a new explicit `CalendarEvent.isPayday` flag (set only on payday events in `CalendarPage.tsx`) rather than inferring it from the label text or tag color, so it can't silently break if either of those ever changes.
- [x] The day cell's other events (holidays/PTO) and the "+N more" overflow count are now computed from the non-payday events only, so a payday no longer eats one of the 2 visible slots.
- [x] Verified live: paydays (every other Friday) show "PAYDAY" directly beside the date number; a day with both payday and PTO (didn't occur in current test data, but the split logic handles it) would show both correctly - payday inline, PTO stacked below.
- [x] Checked at mobile width: the payday tag wraps to sit just below the date number within the same top group when the cell is too narrow to fit both on one line, rather than overflowing - still visually distinct from the day's other stacked events.
- [x] Day-detail modal (click-to-expand) still lists Payday correctly alongside everything else for that day - only the day-cell's own compact rendering changed, not the modal.
- [x] Accessible day-cell labels (e.g. "Friday, September 11, 2026, 1 event") are unaffected - still counts payday toward the total event count.
- [x] No console errors, no page-level horizontal scroll.

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

## Admin Timesheets: row total = current pay period, pay periods expandable ✅ verified

- [x] Each employee row's total tag now always shows their **current pay period** hours ("X.XX hrs this period"), independent of whatever From/To range is selected below - backed by a second `useAdminTimeEntries` call pinned to `getPayPeriodRange(new Date())` rather than derived from the filtered `entries`. Verified live: Ryan Thomas's row correctly showed 10.40 (the current period only), not the old 22.90 grand total across both periods in the default 14-day filter range.
- [x] Each pay period within an expanded employee is now itself a click-to-expand toggle (`.period-head-toggle`, same reset-button-inside-a-plain-div pattern as `.section-head-toggle`) - starts collapsed, showing just the period label + subtotal until clicked, then reveals its day/table breakdown. Keyed by `employeeId|periodKey` so expanding one employee's period doesn't affect another employee's same calendar period.
- [x] Verified live: expanding Ryan Thomas showed both pay periods collapsed; expanding just "Aug 24 - Sep 6" revealed its days/entries while "Aug 10 - Aug 23" stayed collapsed independently.
- [x] Fixed a real (if minor) overflow bug found while testing with the newer employee accounts that still have an email address as their `full_name` (no display name set yet): long unbroken names now truncate with an ellipsis (`.section-head h2` gets `min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) instead of overflowing past the tag/chevron; `.tag`, `.chevron`, and `.section-head .num` all got `flex-shrink:0` so they stay fixed-size while the name is what shrinks. Verified at both mobile (375px, truncates) and desktop (fits, no unnecessary truncation) widths, and confirmed this doesn't regress any other `.tag` usage elsewhere in the app.
- [x] No console errors on a fresh tab.

## Admin Timesheets: removed the Employee filter dropdown ✅ verified

- [x] `/admin/timesheets` no longer has an "Employee" filter dropdown (still lists every employee, per the previous change) - expanding one row is now the only way to drill into a specific person's hours, so there's no longer two different ways to narrow the view. Date range (From/To) filters remain.
- [x] Confirmed **Export** (`/admin/export`) still has its own independent Employee dropdown, untouched - that's a genuinely separate feature (single-employee payroll export) where a dropdown still makes sense, not just leftover duplication.
- [x] Verified live in a fresh tab: all 5 employees list with no dropdown, expand/collapse works correctly and independently per row (confirmed via ref-targeted clicks, not just coordinates), no console errors.

## Admin Timesheets: full roster, expandable per employee ✅ verified

- [x] `/admin/timesheets` now always lists every active employee (from `useEmployees`, not just whoever has entries in the selected range) - built via a new `buildEmployeeGroups(employees, entries)` that left-joins entries onto the full roster, so a 0-entry employee still gets a row (muted "0.00 hrs" tag) instead of silently vanishing.
- [x] Each employee row is now a click-to-expand toggle (`.section-head-toggle`, a reset-button inside the existing `.section-head` div rather than making the div itself a button, since the global bare-`button` selector's own background/border/padding would otherwise fight the section-head styling). Starts collapsed for all when viewing "All"; expanding one doesn't affect the others. A chevron (▸/▾) reflects state, `aria-expanded` set for a11y.
- [x] Selecting one specific employee from the Employee filter now also filters the *roster itself* (not just the entries), so only that one row shows, always expanded, no chevron (nothing else to toggle) - verified with Chris Wiles.
- [x] Verified the zero-entries empty state ("No entries in this range.") renders correctly when expanding an employee with no matching entries (Josh Springer), vs. the pay-period/day breakdown for one who does.
- [x] Verified live: all 5 active employees listed, multiple rows can be expanded simultaneously and independently, existing map links/Edit links/pay-period+day subtotals all still correct at the new toggle layer. Clean at mobile width (375px), no console errors on a fresh tab.

## Admin Timesheets: per-employee day breakdown + pay period totals ✅ verified

- [x] `/admin/timesheets` now nests three levels under each employee's existing `.section-head` (unchanged, still the grand total for the selected date range): a `.period-head` per pay period the selected range touches (label + period subtotal), then a `.day-head` per day within that period (label + day subtotal), then that day's entry table. Extracted `groupByDay`/`groupByPayPeriod` into a new shared `src/lib/timesheetGrouping.ts` so the employee's own Timesheet page and this admin page share one implementation instead of duplicating it. Also renamed `payroll.ts`'s `getCurrentPayPeriodRange` -> `getPayPeriodRange` since it's now called with arbitrary past entry dates, not just "now".
- [x] Verified live with real data spanning a period boundary (the default 14-day filter happened to catch parts of two pay periods): Ryan Thomas's 22.90 hr total correctly split into "Aug 24 - Sep 6" (10.40, = Aug 25's 8.22 + Aug 24's 2.18) and "Aug 10 - Aug 23" (12.50, = Aug 22's 8.00 + Aug 20's 4.50) - both period subtotals and both day subtotals cross-checked by hand and matched exactly, most-recent period and day first.
- [x] Map links (geolocation feature) and Edit links still work correctly at the new nesting depth.
- [x] Checked at mobile width (375px), no horizontal scroll, no console errors on a fresh tab.

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
