-- 0013_holidays_update.sql
-- holidays previously had select (everyone) + insert/delete (admin) but no
-- update policy, so an admin fixing a typo'd name or wrong date had to
-- delete and re-add instead of editing in place.

create policy "holidays_update_admin"
  on public.holidays for update
  using (public.is_admin())
  with check (public.is_admin());
