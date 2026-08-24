-- 0007_employee_names_view.sql
-- Fixes "PTO - Unknown" on the shared team calendar: pto_requests embeds
-- profiles(full_name) via PostgREST, but profiles' RLS policy only lets a
-- non-admin see their OWN row - so every other employee's name resolved to
-- null for a non-admin viewer. Widening profiles' SELECT policy itself would
-- leak hourly_rate/pto_balance_hours/email to every employee, which we don't
-- want. Instead, this is a narrow view exposing only id + full_name.
--
-- Views run with the owner's privileges by default in Postgres (the same
-- mechanism already used by review_pto_request/run_daily_pto_accrual), so
-- this bypasses profiles' RLS in a controlled way - only for the two
-- harmless columns actually selected here, nothing else.
create view public.employee_names as
  select id, full_name from public.profiles;

grant select on public.employee_names to authenticated;

comment on view public.employee_names is 'Public-within-the-company id + full_name lookup, used by the shared team calendar so non-admins can see other employees'' names on approved PTO without exposing pay rate, balance, or email.';
