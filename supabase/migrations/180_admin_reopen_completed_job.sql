-- Lets platform admin undo a job being marked completed by mistake (for
-- example a force-complete on a job that is still in progress).
--
-- Completing a job does four things this puts back:
--   1. status        -> the status the job had just before it was completed
--   2. completed_at  -> cleared (payroll counts jobs by this date)
--   3. final_driver_pay_cents -> cleared, so pay is the live estimate again
--   4. performance bonus figures -> cleared (recalculated if it completes again)
-- A job_status_events row records who reopened it and when. The status is
-- restored with dynamic SQL so it works whether jobs.status is text or an enum.
create or replace function admin_reopen_completed_job(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  j jobs%rowtype;
  v_prev text;
begin
  if my_role() is distinct from 'platform_admin' then
    raise exception 'Only platform admin can reopen a completed job.';
  end if;

  select * into j from jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found.';
  end if;
  if j.status::text is distinct from 'completed' then
    raise exception 'This job is not completed (it is %).', j.status::text;
  end if;

  select e.status::text into v_prev
  from job_status_events e
  where e.job_id = p_job_id and e.status::text <> 'completed'
  order by e.created_at desc
  limit 1;

  if v_prev is null or v_prev not in ('assigned', 'picked_up', 'in_progress', 'delivered') then
    v_prev := case when j.driver_id is not null then 'in_progress' else 'awaiting_driver' end;
  end if;

  execute format(
    'update jobs set status = %L, completed_at = null, final_driver_pay_cents = null, performance_bonus_cents = null, performance_bonus_eligible = null where id = %L',
    v_prev, p_job_id
  );

  insert into job_status_events (job_id, status, changed_by)
  values (p_job_id, v_prev, auth.uid());

  return v_prev;
end;
$$;
grant execute on function admin_reopen_completed_job(uuid) to authenticated;
notify pgrst, 'reload schema';
