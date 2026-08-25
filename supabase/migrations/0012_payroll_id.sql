-- 0012_payroll_id.sql
-- Each employee's ID in the external payroll system (GRIN), admin-set, used
-- by the payroll export (src/lib/payrollExport.ts) to populate the
-- EmployeeID column of the GRIN import template. Free text since we don't
-- know GRIN's exact ID format/length constraints; blank until an admin
-- fills it in.

alter table public.profiles
  add column payroll_id text;

comment on column public.profiles.payroll_id is 'Employee ID in the external payroll system (GRIN), used by the payroll export. Admin-set only.';

-- profiles_update_own_limited (0002_rls_policies.sql) already locks
-- employees out of self-editing role/pay_type/hourly_rate/
-- employment_status/pto_balance_hours - add payroll_id to that same list
-- so a self-update can't smuggle in a payroll_id change. Drop + recreate
-- since Postgres has no ALTER POLICY for changing the check clause.
drop policy "profiles_update_own_limited" on public.profiles;

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
    and payroll_id is not distinct from (select payroll_id from public.profiles where id = auth.uid())
  );
