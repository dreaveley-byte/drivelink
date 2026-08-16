-- The overlap-check query inside claim_job_if_no_conflict does
-- `where driver_id = auth.uid() and status in (...)` with no supporting
-- index, meaning every single claim was doing a full table scan of jobs -
-- getting slower as the table grows. This was very likely the real cause of
-- the noticeable pause when claiming a job.
create index if not exists jobs_driver_id_status_idx on jobs(driver_id, status);

-- Also fold the job_status_events insert into this same function (it already
-- runs server-side with auth.uid() available) instead of a separate
-- round-trip from the client after the claim succeeds - one fewer network
-- round-trip on every claim.
create or replace function claim_job_if_no_conflict(p_job_id uuid)
returns jobs
language plpgsql
security definer
as $$
declare
  v_job jobs;
  v_start timestamptz;
  v_end timestamptz;
  v_conflict_count int;
  v_has_active_jobs int;
begin
  select * into v_job from jobs where id = p_job_id for update;

  if v_job is null then
    raise exception 'Job not found.';
  end if;

  if v_job.status <> 'awaiting_driver' then
    raise exception 'This job is no longer available — someone else may have just claimed it.';
  end if;

  select count(*) into v_has_active_jobs
  from jobs where driver_id = auth.uid() and status in ('assigned', 'picked_up', 'in_progress', 'delivered');

  if v_has_active_jobs > 0 then
    if v_job.scheduled_for is null then
      raise exception 'This job has no scheduled time, and you already have an active job — claim it once your current job is finished.';
    end if;

    v_start := v_job.scheduled_for;
    v_end := v_start + (coalesce(v_job.estimated_duration_minutes, 60) * 2 || ' minutes')::interval;

    select count(*) into v_conflict_count
    from jobs existing
    where existing.driver_id = auth.uid()
      and existing.status in ('assigned', 'picked_up', 'in_progress', 'delivered')
      and (
        existing.scheduled_for is null
        or (
          v_start < existing.scheduled_for + (coalesce(existing.estimated_duration_minutes, 60) * 2 || ' minutes')::interval
          and existing.scheduled_for < v_end
        )
      );

    if v_conflict_count > 0 then
      raise exception 'This job overlaps with a delivery time you already have scheduled — pick one or the other.';
    end if;
  end if;

  update jobs set driver_id = auth.uid(), status = 'assigned' where id = p_job_id returning * into v_job;

  insert into job_status_events (job_id, status, changed_by) values (p_job_id, 'assigned', auth.uid());

  return v_job;
end;
$$;

grant execute on function claim_job_if_no_conflict(uuid) to authenticated;
