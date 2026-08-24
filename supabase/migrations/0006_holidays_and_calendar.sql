-- 0006_holidays_and_calendar.sql
-- Supports the home-page month calendar (paydays, holidays, scheduled PTO):
--   - a new admin-managed holidays list
--   - a widened (additive) read policy so every employee can see everyone's
--     *approved* PTO/sick time for a "who's out" view - pending/denied
--     requests stay private to the owner + admin, unchanged from before.
-- Paydays are pure client-side arithmetic (see src/lib/payroll.ts) and need
-- no table.

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null unique,
  created_at timestamptz not null default now()
);

comment on table public.holidays is 'Admin-managed company holidays shown on the home-page calendar.';

alter table public.holidays enable row level security;

create policy "holidays_select_all"
  on public.holidays for select
  using (true);

create policy "holidays_insert_admin"
  on public.holidays for insert
  with check (public.is_admin());

create policy "holidays_delete_admin"
  on public.holidays for delete
  using (public.is_admin());

-- Additive: OR's with the existing "own row or admin" SELECT policy on
-- pto_requests, so this only ever widens visibility for approved rows -
-- pending/denied requests are still only visible to the owner and admins.
create policy "pto_requests_select_approved_all"
  on public.pto_requests for select
  using (status = 'approved');
