-- 0009_time_entry_geolocation.sql
-- Best-effort device geolocation captured at clock-in and clock-out, via the
-- browser Geolocation API (src/lib/geolocation.ts). Always optional - a
-- denied/unavailable/timed-out location never blocks the punch itself, so
-- these columns are nullable with no default. Admin-only visibility is a UI
-- decision (src/routes/admin/TimesheetsPage.tsx); no RLS change is needed
-- here since the existing time_entries_insert_self and
-- time_entries_update_self_clockout policies (0004/0008) already cover
-- exactly the two moments these columns get written - a live clock-in and a
-- live clock-out of your own entry - and don't reference these columns, so
-- they're unrestricted for those same two writes and untouched everywhere
-- else (in particular, still blocked entirely on the manual-edit paths that
-- were removed in 0008).

alter table public.time_entries
  add column clock_in_lat numeric(9, 6),
  add column clock_in_lng numeric(9, 6),
  add column clock_in_accuracy_m numeric(7, 1),
  add column clock_out_lat numeric(9, 6),
  add column clock_out_lng numeric(9, 6),
  add column clock_out_accuracy_m numeric(7, 1),
  add constraint clock_in_lat_range check (clock_in_lat is null or clock_in_lat between -90 and 90),
  add constraint clock_in_lng_range check (clock_in_lng is null or clock_in_lng between -180 and 180),
  add constraint clock_out_lat_range check (clock_out_lat is null or clock_out_lat between -90 and 90),
  add constraint clock_out_lng_range check (clock_out_lng is null or clock_out_lng between -180 and 180);

comment on column public.time_entries.clock_in_lat is 'Best-effort device geolocation at clock-in. Null if permission was denied/unavailable - never blocks the punch. Admin-only in the UI.';
comment on column public.time_entries.clock_out_lat is 'Best-effort device geolocation at clock-out. Same nullability/visibility notes as clock_in_lat.';
