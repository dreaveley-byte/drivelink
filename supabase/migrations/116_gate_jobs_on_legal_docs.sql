-- Enforce the "sign before you can get jobs" rule at the database layer too,
-- not just in the driver/dashboard page UI. The UI gate (LegalGateModal in
-- src/app/driver/page.tsx and src/app/dashboard/page.tsx) is what most users
-- see, but claim_job_if_no_conflict() and a direct `jobs` insert are both
-- reachable straight from the client (supabase-js RPC / insert), so without a
-- server-side check here a driver/dealer could still get/post jobs while an
-- outstanding required document sits unsigned. These required-doc slug lists
-- mirror DRIVER_REQUIRED_DOCS / DEALER_REQUIRED_DOCS in src/lib/legalDocuments.ts
-- — keep them in sync if that file changes.

-- ============================================
-- Drivers: block claiming a job while a required document is outstanding.
-- ============================================
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


-- ============================================
-- Dealers: block posting a new job while a required document is outstanding.
-- Only applies to org_admin/org_member-created jobs (i.e. dealers posting
-- their own jobs) — jobs created by platform_admin on a dealer's behalf are
-- not blocked by this.
-- ============================================
create or replace function check_legal_docs_before_job_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  v_role text;
  v_outstanding_docs int;
begin
  if new.created_by is null then
    return new;
  end if;

  select role into v_role from profiles where id = new.created_by;

  if v_role is distinct from 'org_admin' and v_role is distinct from 'org_member' then
    return new;
  end if;

  select count(*) into v_outstanding_docs
  from legal_documents ld
  where ld.is_current
    and ld.slug in (
      'dealer_master_services_agreement',
      'fee_waiting_cancellation_policy',
      'privacy_policy',
      'platform_terms_of_service'
    )
    and not exists (
      select 1 from legal_acceptances la
      where la.user_id = new.created_by
        and la.document_slug = ld.slug
        and la.document_version = ld.version
    );

  if v_outstanding_docs > 0 then
    raise exception 'A new agreement needs to be signed before you can post jobs — visit /dashboard/resign to review it.';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_require_current_legal_docs on jobs;
create trigger jobs_require_current_legal_docs
  before insert on jobs
  for each row execute function check_legal_docs_before_job_insert();
