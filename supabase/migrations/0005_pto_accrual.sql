-- 0005_pto_accrual.sql
-- Automates the PTO accrual policy:
--   - +40 hours added to every active employee's balance every January 1st,
--     on top of whatever's left (unused PTO carries over, no reset).
--   - +80 hours/year accrued in 26 equal biweekly installments
--     (80 / 26 ≈ 3.08 hours per 2-week pay period), anchored so the first
--     automated accrual lands 2026-08-24 - the start of the pay period
--     following the one that ended 2026-08-23. This does not backfill any
--     periods before that date; the balance up to now has been managed
--     manually.
-- Runs via pg_cron once a day; the function itself decides whether today
-- is an accrual day, so the cron schedule can stay a simple daily tick.

create extension if not exists pg_cron;

-- Guards against a cron retry/misfire applying the same day's accrual twice.
create table public.pto_accrual_log (
  run_date date not null,
  kind text not null check (kind in ('annual_grant', 'biweekly_accrual')),
  primary key (run_date, kind)
);

comment on table public.pto_accrual_log is 'One row per day an accrual actually ran, so a cron retry cannot double-apply it. No client access - internal bookkeeping only.';

alter table public.pto_accrual_log enable row level security;
-- Intentionally no policies: only the SECURITY DEFINER function below (which
-- runs as the table owner and so bypasses RLS) can touch this table.

create function public.run_daily_pto_accrual()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_anchor date := date '2026-08-24';
  v_days_since_anchor int;
begin
  -- Annual grant: +40 hours for every active employee on January 1st.
  if extract(month from v_today) = 1 and extract(day from v_today) = 1 then
    if not exists (select 1 from public.pto_accrual_log where run_date = v_today and kind = 'annual_grant') then
      update public.profiles
      set pto_balance_hours = pto_balance_hours + 40
      where employment_status = 'active';

      insert into public.pto_accrual_log (run_date, kind) values (v_today, 'annual_grant');
    end if;
  end if;

  -- Biweekly accrual: 80 hours/year over 26 periods, anchored to v_anchor.
  v_days_since_anchor := v_today - v_anchor;
  if v_days_since_anchor >= 0 and v_days_since_anchor % 14 = 0 then
    if not exists (select 1 from public.pto_accrual_log where run_date = v_today and kind = 'biweekly_accrual') then
      update public.profiles
      set pto_balance_hours = pto_balance_hours + (80.0 / 26)
      where employment_status = 'active';

      insert into public.pto_accrual_log (run_date, kind) values (v_today, 'biweekly_accrual');
    end if;
  end if;
end;
$$;

comment on function public.run_daily_pto_accrual is 'Run once per day by pg_cron (see the pto-accrual-daily job). Applies the Jan 1 annual grant and the biweekly accrual, each idempotent via pto_accrual_log.';

select cron.schedule(
  'pto-accrual-daily',
  '0 6 * * *', -- 6am UTC daily; the function itself decides whether today is an accrual day
  $$select public.run_daily_pto_accrual();$$
);
