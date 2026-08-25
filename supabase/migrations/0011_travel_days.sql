-- 0011_travel_days.sql
-- Per diem travel day log. A flat daily travel allowance is paid for each
-- logged day - like hourly pay elsewhere in this app, the actual dollar
-- amount is computed manually at payroll time (no rate/amount stored here,
-- consistent with the app never auto-calculating pay). One row per
-- employee per date; available to every employee regardless of pay_type,
-- since travel per diem isn't tied to hourly-vs-salaried status the way
-- the overtime alert is.

create table public.travel_days (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  travel_date date not null,
  notes text,
  source text not null default 'self' check (source in ('self', 'admin')),
  logged_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (employee_id, travel_date)
);

comment on table public.travel_days is 'Per diem travel day log - one flat allowance per logged day, amount computed manually at payroll time. Visible on the employee Clock tab and the admin Export page.';

alter table public.travel_days enable row level security;

create policy "travel_days_select_own_or_admin"
  on public.travel_days for select
  using (employee_id = auth.uid() or public.is_admin());

-- Self logging: only your own days, only something that's already happened
-- (no future-dating), and only within a 14-day window - same backdating
-- limit already used for self time-entry actions elsewhere in this app.
create policy "travel_days_insert_self"
  on public.travel_days for insert
  with check (
    employee_id = auth.uid()
    and source = 'self'
    and logged_by = auth.uid()
    and travel_date between current_date - interval '14 days' and current_date
  );

create policy "travel_days_insert_admin"
  on public.travel_days for insert
  with check (public.is_admin() and source = 'admin' and logged_by = auth.uid());

-- Self-delete only within the same 14-day window (undo a mistake shortly
-- after logging it); admin can delete anything.
create policy "travel_days_delete_self_recent"
  on public.travel_days for delete
  using (employee_id = auth.uid() and source = 'self' and created_at >= now() - interval '14 days');

create policy "travel_days_delete_admin"
  on public.travel_days for delete
  using (public.is_admin());
