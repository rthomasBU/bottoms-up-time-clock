-- 0008_remove_employee_manual_time_entry.sql
-- Manual time entry (backdated add, or editing an existing entry's times) is
-- now admin-only. Employees keep the live clock in/out flow only - no more
-- self-service "+ Add Entry" / "Edit" on their own timesheet. Admins are
-- unaffected: time_entries_insert_admin / time_entries_update_admin /
-- time_entries_delete_admin from 0002 still cover full admin correction.

-- ---------------------------------------------------------------------------
-- Drop the manual-correction UPDATE policy for employees entirely. The only
-- remaining self-service UPDATE path is time_entries_update_self_clockout
-- (closing your own currently-open entry).
-- ---------------------------------------------------------------------------
drop policy "time_entries_update_self_manual_edit" on public.time_entries;

-- ---------------------------------------------------------------------------
-- Tighten self-insert to only allow a genuine live clock-in (clock_in within
-- a few minutes of now()), not an arbitrary backdated add - and block
-- edited_by/edit_reason from being set on a self insert, since those are
-- admin-manual-entry fields only.
-- ---------------------------------------------------------------------------
drop policy "time_entries_insert_self" on public.time_entries;

create policy "time_entries_insert_self"
  on public.time_entries for insert
  with check (
    employee_id = auth.uid()
    and source = 'self'
    and clock_in between now() - interval '5 minutes' and now() + interval '5 minutes'
    and edited_by is null
    and edit_reason is null
  );

-- Same tightening on the clock-out update: an employee closing their own
-- entry can't sneak edited_by/edit_reason onto it in the same request.
drop policy "time_entries_update_self_clockout" on public.time_entries;

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
    and edited_by is null
    and edit_reason is null
  );

-- ---------------------------------------------------------------------------
-- Belt-and-suspenders: a WITH CHECK policy can only see the new row, not the
-- old one, so it can't by itself guarantee clock_in is unchanged on a
-- clock-out update. A trigger can see both, so this is what actually makes
-- "employees can't backdate their own entries" a hard guarantee rather than
-- something that depends on every self-update policy staying narrow forever.
-- ---------------------------------------------------------------------------
create function public.prevent_self_time_entry_backdating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and old.source = 'self' and new.clock_in is distinct from old.clock_in then
    raise exception 'Employees cannot change their clock-in time. Ask an admin to correct this entry.';
  end if;
  return new;
end;
$$;

create trigger time_entries_prevent_self_backdating
  before update on public.time_entries
  for each row
  execute function public.prevent_self_time_entry_backdating();
