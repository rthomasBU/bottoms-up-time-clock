-- 0014_tech_support_days.sql
-- Tech support day log, same shape and rules as travel_days
-- (0011_travel_days.sql) - a flat daily allowance is paid for each logged
-- day, actual dollar amount computed manually at payroll time. One row per
-- employee per date; available to every employee regardless of pay_type.
-- Feeds the existing (previously always-blank) Pay/Tech Support/Units
-- column of the GRIN payroll export.

create table public.tech_support_days (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  support_date date not null,
  notes text,
  source text not null default 'self' check (source in ('self', 'admin')),
  logged_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (employee_id, support_date)
);

comment on table public.tech_support_days is 'Tech support day log - one flat allowance per logged day, amount computed manually at payroll time. Visible on the employee Tech Support tab and the admin Export page.';

alter table public.tech_support_days enable row level security;

create policy "tech_support_days_select_own_or_admin"
  on public.tech_support_days for select
  using (employee_id = auth.uid() or public.is_admin());

-- Self logging: only your own days, only something that's already happened
-- (no future-dating), and only within a 14-day window - same backdating
-- limit already used for travel_days and self time-entry actions elsewhere.
create policy "tech_support_days_insert_self"
  on public.tech_support_days for insert
  with check (
    employee_id = auth.uid()
    and source = 'self'
    and logged_by = auth.uid()
    and support_date between current_date - interval '14 days' and current_date
  );

create policy "tech_support_days_insert_admin"
  on public.tech_support_days for insert
  with check (public.is_admin() and source = 'admin' and logged_by = auth.uid());

-- Self-delete only within the same 14-day window (undo a mistake shortly
-- after logging it); admin can delete anything.
create policy "tech_support_days_delete_self_recent"
  on public.tech_support_days for delete
  using (employee_id = auth.uid() and source = 'self' and created_at >= now() - interval '14 days');

create policy "tech_support_days_delete_admin"
  on public.tech_support_days for delete
  using (public.is_admin());
