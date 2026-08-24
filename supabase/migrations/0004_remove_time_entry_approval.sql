-- 0004_remove_time_entry_approval.sql
-- Approval is now PTO-only. Time entries no longer go through an admin
-- approve step: employees can self-report their own hours (live clock
-- in/out, or a manual add/edit within a 14-day window with a required
-- reason), and admins can still browse/correct any entry directly.
-- pto_requests / review_pto_request are untouched by this migration.

-- ---------------------------------------------------------------------------
-- Drop the policies that reference status first - Postgres won't let a
-- column be dropped while a policy still depends on it.
-- ---------------------------------------------------------------------------
drop policy "time_entries_insert_self" on public.time_entries;
drop policy "time_entries_update_self_clockout" on public.time_entries;

-- ---------------------------------------------------------------------------
-- Now the columns that only existed to support the old approval workflow
-- can be dropped.
-- ---------------------------------------------------------------------------
alter table public.time_entries
  drop column status,
  drop column reviewed_by,
  drop column reviewed_at;

-- ---------------------------------------------------------------------------
-- Recreate the policies against the new shape.
-- ---------------------------------------------------------------------------

-- Self insert: live clock-in or a manual add, either way within the last
-- 14 days. (A live clock-in always has clock_in = now(), so this window
-- never affects that path - it only bounds manual/backdated adds.)
create policy "time_entries_insert_self"
  on public.time_entries for insert
  with check (
    employee_id = auth.uid()
    and source = 'self'
    and clock_in >= now() - interval '14 days'
  );

-- Closing an open entry via the Clock Out button - no reason required,
-- this isn't a correction, it's the normal live flow.
create policy "time_entries_update_self_clockout"
  on public.time_entries for update
  using (
    employee_id = auth.uid()
    and source = 'self'
    and clock_out is null
  )
  with check (
    employee_id = auth.uid()
    and source = 'self'
  );

-- Manual correction of any of the employee's own recent entries (open or
-- already closed) - requires a reason and self-attribution. This is a
-- second permissive UPDATE policy alongside the clock-out one above;
-- Postgres OR's permissive policies together, so either path independently
-- allows the update.
create policy "time_entries_update_self_manual_edit"
  on public.time_entries for update
  using (
    employee_id = auth.uid()
    and source = 'self'
    and clock_in >= now() - interval '14 days'
  )
  with check (
    employee_id = auth.uid()
    and source = 'self'
    and edited_by = auth.uid()
    and edit_reason is not null
    and btrim(edit_reason) <> ''
    and clock_in >= now() - interval '14 days'
  );

-- time_entries_insert_admin, time_entries_update_admin, and
-- time_entries_delete_admin from 0002 are unaffected (they never
-- referenced status) and are left as-is.
