-- 0003_pto_approval_function.sql
-- Atomically reviews a PTO request (approve/deny) and, on approval, decrements
-- the employee's pto_balance_hours in the same transaction. Doing this as an
-- RPC (rather than two separate client-side updates) avoids a partial-failure
-- state and a double-approval race between two admins reviewing at once.

create function public.review_pto_request(p_request_id uuid, p_approve boolean, p_notes text default null)
returns public.pto_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.pto_requests;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review PTO requests';
  end if;

  select * into v_request from public.pto_requests where id = p_request_id for update;
  if v_request is null then
    raise exception 'PTO request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been reviewed';
  end if;

  update public.pto_requests
  set status = case when p_approve then 'approved' else 'denied' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      notes = coalesce(p_notes, notes)
  where id = p_request_id
  returning * into v_request;

  if p_approve then
    update public.profiles
    set pto_balance_hours = pto_balance_hours - v_request.hours_requested
    where id = v_request.employee_id;
  end if;

  return v_request;
end;
$$;

comment on function public.review_pto_request is 'Admin-only: approve or deny a pending PTO request, decrementing the balance atomically on approval.';

grant execute on function public.review_pto_request(uuid, boolean, text) to authenticated;

-- Missing from 0002: employees may cancel (delete) their own request while
-- it's still pending, per the plan ("employee can edit/cancel their own
-- pending request"). Reviewed/approved/denied requests are immutable to
-- the employee and can only be removed by an admin.
create policy "pto_requests_delete_self_pending"
  on public.pto_requests for delete
  using (employee_id = auth.uid() and status = 'pending');
