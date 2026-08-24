-- 0001_initial_schema.sql
-- Core tables: profiles (extends auth.users), time_entries, pto_requests.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  pay_type text not null default 'hourly' check (pay_type in ('hourly', 'salaried')),
  hourly_rate numeric(8, 2),
  employment_status text not null default 'active' check (employment_status in ('active', 'inactive')),
  pto_balance_hours numeric(6, 2) not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per employee, 1:1 with auth.users. Source of truth for role and pay type.';

-- Auto-create a stub profile whenever a new auth user is created.
-- Admin fills in role/pay_type/full_name afterward (defaults: employee/hourly).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  source text not null default 'self' check (source in ('self', 'admin_manual')),
  edited_by uuid references public.profiles (id),
  edit_reason text,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint clock_out_after_clock_in check (clock_out is null or clock_out > clock_in)
);

comment on table public.time_entries is 'Individual clock-in/out punches. Duration computed at query time, never stored.';

-- At most one open (still clocked-in) entry per employee.
create unique index one_open_entry_per_employee
  on public.time_entries (employee_id)
  where clock_out is null;

create index time_entries_employee_id_idx on public.time_entries (employee_id);
create index time_entries_status_idx on public.time_entries (status);

-- ---------------------------------------------------------------------------
-- pto_requests
-- ---------------------------------------------------------------------------
create table public.pto_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  pto_type text not null check (pto_type in ('pto', 'sick')),
  start_date date not null,
  end_date date not null,
  hours_requested numeric(6, 2) not null check (hours_requested > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint end_after_start check (end_date >= start_date)
);

comment on table public.pto_requests is 'Employee PTO/sick time requests. Approving decrements profiles.pto_balance_hours.';

create index pto_requests_employee_id_idx on public.pto_requests (employee_id);
create index pto_requests_status_idx on public.pto_requests (status);
