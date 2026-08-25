-- 0015_fix_payroll_id_column.sql
-- 0012_payroll_id.sql was never actually applied to this project - the
-- column it adds (profiles.payroll_id, a plain snake_case text column, no
-- quoting needed) doesn't exist. What exists instead is a column manually
-- added through the Table Editor UI named literally "Employee ID" (space,
-- capitals, numeric type) with 10 employees' real GRIN IDs already entered
-- into it. This migration reconciles the two: creates the column the app
-- code actually expects, copies the real data over, drops the stray
-- column, and (re)applies the self-edit lockout so payroll_id joins the
-- same "admin only" list as role/pay_type/hourly_rate/etc - safe to run
-- whether or not any part of 0012 already applied, since every step below
-- is idempotent.

alter table public.profiles
  add column if not exists payroll_id text;

comment on column public.profiles.payroll_id is 'Employee ID in the external payroll system (GRIN), used by the payroll export. Admin-set only.';

update public.profiles
set payroll_id = "Employee ID"::text
where payroll_id is null and "Employee ID" is not null;

alter table public.profiles
  drop column if exists "Employee ID";

drop policy if exists "profiles_update_own_limited" on public.profiles;

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
