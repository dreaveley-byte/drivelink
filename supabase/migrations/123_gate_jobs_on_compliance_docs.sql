-- Extends claim_job_if_no_conflict() (originally from
-- 116_gate_jobs_on_legal_docs.sql) to also require the recurring
-- compliance documents - driver's abstract, drug/alcohol test, medical
-- fitness test, and vulnerable sector/criminal record check - to each be
-- uploaded, reviewed by admin, and not older than 12 months (matching BC's
-- actual Record Check Certificate renewal requirement for
-- passenger-directed vehicle drivers) before a driver can claim any job.
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
  v_outstanding_docs int;
  v_profile profiles;
  v_missing_compliance text[] := '{}';
begin
  select count(*) into v_outstanding_docs
  from legal_documents ld
  where ld.is_current
    and ld.slug in (
      'driver_contractor_agreement',
      'drug_alcohol_policy',
      'driver_standards_code_of_conduct',
      'vehicle_inspection_damage_policy',
      'driver_expense_reimbursement_policy',
      'privacy_policy',
      'platform_terms_of_service'
    )
    and not exists (
      select 1 from legal_acceptances la
      where la.user_id = auth.uid()
        and la.document_slug = ld.slug
        and la.document_version = ld.version
    );

  if v_outstanding_docs > 0 then
    raise exception 'A new agreement needs to be signed before you can claim jobs — visit /driver/resign to review it.';
  end if;

  select * into v_profile from profiles where id = auth.uid();

  if v_profile.driver_abstract_reviewed_at is null or v_profile.driver_abstract_reviewed_at < now() - interval '12 months' then
    v_missing_compliance := array_append(v_missing_compliance, 'driver''s abstract');
  end if;
  if v_profile.drug_alcohol_test_reviewed_at is null or v_profile.drug_alcohol_test_reviewed_at < now() - interval '12 months' then
    v_missing_compliance := array_append(v_missing_compliance, 'drug & alcohol test');
  end if;
  if v_profile.medical_fitness_test_reviewed_at is null or v_profile.medical_fitness_test_reviewed_at < now() - interval '12 months' then
    v_missing_compliance := array_append(v_missing_compliance, 'medical fitness test');
  end if;
  if v_profile.vulnerable_sector_check_reviewed_at is null or v_profile.vulnerable_sector_check_reviewed_at < now() - interval '12 months' then
    v_missing_compliance := array_append(v_missing_compliance, 'vulnerable sector check');
  end if;

  if array_length(v_missing_compliance, 1) > 0 then
    raise exception 'Your % needs to be uploaded and reviewed before you can claim jobs — visit your profile to upload it.', array_to_string(v_missing_compliance, ', ');
  end if;

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
