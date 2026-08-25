-- 0010_overtime_alerts.sql
-- Push notification when an hourly employee has been clocked in for more
-- than 8 hours on a single (still-open) punch, repeating every 2 hours
-- after that for as long as they stay clocked in. Actually sending the
-- push happens outside Postgres (VAPID-signed Web Push needs real crypto/
-- HTTP, not something plpgsql can do) - see supabase/functions/
-- send-overtime-alerts, invoked on a schedule by pg_cron + pg_net. That
-- cron job itself is NOT created here since it has to embed a shared
-- secret to authenticate to the function - it's a one-off SQL snippet run
-- by hand after the function is deployed, same as every other secret in
-- this project (never committed to a migration file).

-- ---------------------------------------------------------------------------
-- One row per (employee, browser/device) that has opted in to push
-- notifications. A device subscribes itself (insert) and can remove itself
-- (delete); the Edge Function reads these with the service role key, which
-- bypasses RLS entirely, so no special policy is needed for it.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

comment on table public.push_subscriptions is 'Web Push subscriptions, one row per device that opted in. Currently only used for the hourly-overtime alert.';

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own_or_admin"
  on public.push_subscriptions for select
  using (employee_id = auth.uid() or public.is_admin());

create policy "push_subscriptions_insert_self"
  on public.push_subscriptions for insert
  with check (employee_id = auth.uid());

create policy "push_subscriptions_delete_self_or_admin"
  on public.push_subscriptions for delete
  using (employee_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Tracks the last time an overtime push was sent for a given open entry, so
-- the Edge Function can tell "never notified", "notified, due for the next
-- 2-hour repeat", and "notified recently, not due yet" apart. Only ever
-- written by the Edge Function (service role) - no self/admin RLS policy
-- references it, so it isn't a normal client-editable field.
-- ---------------------------------------------------------------------------
alter table public.time_entries
  add column last_overtime_notified_at timestamptz;

comment on column public.time_entries.last_overtime_notified_at is 'Set by the send-overtime-alerts Edge Function each time it pushes an overtime alert for this (still-open) entry. Null until the first alert.';

-- Required for pg_cron to reach the Edge Function over HTTP.
create extension if not exists pg_net;
