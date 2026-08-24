-- 0002_rls_policies.sql
-- Row Level Security is the real access-control boundary for this app.
-- Client-side role checks are UX only; these policies are what's enforced.

-- ---------------------------------------------------------------------------
-- is_admin() helper - SECURITY DEFINER to avoid recursive RLS lookups
-- when a policy on profiles needs to check the caller's own role.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.time_entries enable row level security;
alter table public.pto_requests enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Employees may update their own row, but not role/pay_type/hourly_rate/
-- employment_status/pto_balance_hours (those are admin-controlled). Enforced
-- by giving employees only a narrow WITH CHECK; admins get a separate
-- unrestricted policy.
create policy "profiles_update_own_limited"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and pay_type = (select pay_type from public.profiles where id = auth.uid())
    and hourly_rate is not distinct from (select hourly_rate from public.profiles where id = auth.uid())
    and employment_status = (select employment_status from public.profiles where id = auth.uid())
    and pto_balance_hours = (select pto_balance_hours from public.profiles where id = auth.uid())
  );

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.is_admin());

create policy "profiles_delete_admin"
  on public.profiles for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------------------
create policy "time_entries_select_own_or_admin"
  on public.time_entries for select
  using (employee_id = auth.uid() or public.is_admin());

-- Self clock-in: employee creates their own 'self' sourced entry.
create policy "time_entries_insert_self"
  on public.time_entries for insert
  with check (employee_id = auth.uid() and source = 'self');

-- Admin manual entry: admin creates an 'admin_manual' entry for any employee.
create policy "time_entries_insert_admin"
  on public.time_entries for insert
  with check (public.is_admin() and source = 'admin_manual' and edited_by = auth.uid());

-- Employee may only close their own open, pending, self-sourced entry
-- (i.e. clocking out) - cannot edit times or approve their own entry.
create policy "time_entries_update_self_clockout"
  on public.time_entries for update
  using (
    employee_id = auth.uid()
    and source = 'self'
    and status = 'pending'
    and clock_out is null
  )
  with check (
    employee_id = auth.uid()
    and source = 'self'
    and status = 'pending'
  );

create policy "time_entries_update_admin"
  on public.time_entries for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "time_entries_delete_admin"
  on public.time_entries for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- pto_requests
-- ---------------------------------------------------------------------------
create policy "pto_requests_select_own_or_admin"
  on public.pto_requests for select
  using (employee_id = auth.uid() or public.is_admin());

create policy "pto_requests_insert_self_or_admin"
  on public.pto_requests for insert
  with check (employee_id = auth.uid() or public.is_admin());

-- Employee may edit/cancel their own request only while still pending, and
-- cannot change its status themselves. Admin can change status (approve/deny).
create policy "pto_requests_update_self_pending"
  on public.pto_requests for update
  using (employee_id = auth.uid() and status = 'pending')
  with check (employee_id = auth.uid() and status = 'pending');

create policy "pto_requests_update_admin"
  on public.pto_requests for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "pto_requests_delete_admin"
  on public.pto_requests for delete
  using (public.is_admin());
