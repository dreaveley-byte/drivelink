-- Driver eligibility, licence expiry, in-app notifications, SMS hours.
-- (Nov 2026 driver-app update.)

-- ============================================================
-- 1. Licence expiry. NO grace period and NO admin override.
-- ============================================================
alter table profiles add column if not exists license_expiry_date date;           -- approved, effective expiry
alter table profiles add column if not exists license_approved_at timestamptz;
alter table profiles add column if not exists license_pending_expiry_date date;   -- read from the newest uploaded photo, awaiting admin approval
alter table profiles add column if not exists license_pending_uploaded_at timestamptz;
alter table profiles add column if not exists license_expiry_source text check (license_expiry_source in ('photo', 'manual'));
alter table driver_applications add column if not exists extracted_license_expiry date;
-- Existing drivers have no expiry on file yet: they get a one-time window to
-- upload their licence, after which a missing/unapproved expiry blocks jobs.
alter table profiles add column if not exists license_transition_until timestamptz;
alter table pricing_settings add column if not exists license_transition_days int not null default 14;

update profiles
set license_transition_until = now() + ((select license_transition_days from pricing_settings where id = 1) * interval '1 day')
where role = 'driver' and license_expiry_date is null and license_transition_until is null;

-- Drivers can upload a new licence (pending) but can never set or approve the
-- effective expiry themselves - only an admin can.
create or replace function protect_license_fields()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and my_role() is distinct from 'platform_admin' then
    if NEW.license_expiry_date is distinct from OLD.license_expiry_date
       or NEW.license_approved_at is distinct from OLD.license_approved_at
       or NEW.license_transition_until is distinct from OLD.license_transition_until then
      raise exception 'Only an admin can approve a licence expiry date.';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists protect_license_fields_trg on profiles;
create trigger protect_license_fields_trg before update on profiles
  for each row execute function protect_license_fields();

create or replace function is_driver_license_valid(p_driver_id uuid)
returns boolean language plpgsql stable as $$
declare v profiles;
begin
  select * into v from profiles where id = p_driver_id;
  if v is null or v.role <> 'driver' then return true; end if;
  if v.license_expiry_date is not null then
    return v.license_expiry_date >= (now() at time zone 'America/Vancouver')::date;
  end if;
  return v.license_transition_until is not null and v.license_transition_until > now();
end;
$$;

-- ============================================================
-- 2. One place for "can this driver take this job?"
--    Returns null when eligible, otherwise a plain-English reason.
--    Missing capability answers (null) do NOT block - the app flags the
--    requirement in red on the job instead (transition period).
-- ============================================================
create or replace function driver_job_ineligibility(p_driver_id uuid, p_job jobs)
returns text language plpgsql stable as $$
declare p profiles;
begin
  select * into p from profiles where id = p_driver_id;
  if p is null or p.role <> 'driver' then return 'Only drivers can take jobs.'; end if;
  if not p.is_active then return 'Your driver account is not active.'; end if;
  if not is_driver_license_valid(p_driver_id) then
    return 'Your driver''s licence is expired or not approved. You cannot view or claim jobs until a valid licence has been uploaded and approved.';
  end if;
  if not is_driver_documentation_complete(p_driver_id) then
    return 'Your driver documentation is incomplete or out of date - visit your Compliance settings to see what''s missing.';
  end if;
  if p.transmission_capability = 'automatic' and (p_job.vehicle_transmission = 'manual' or p_job.second_vehicle_transmission = 'manual') then
    return 'This job needs a driver who can drive a manual transmission.';
  end if;
  if p.can_tow_trailer = false and p_job.vehicle_mode = 'towed' then
    return 'This job involves towing and your profile says you cannot tow.';
  end if;
  if p.max_drive_range_km is not null and p_job.estimated_distance_km is not null and p_job.estimated_distance_km > p.max_drive_range_km then
    return 'This job is longer than your maximum drive range.';
  end if;
  return null;
end;
$$;

-- Drivers who fail the licence/document/active checks see NO available jobs.
create or replace function get_available_jobs_for_driver(p_driver_id uuid)
returns setof jobs language sql security definer stable as $$
  select j.* from jobs j
  where j.status = 'awaiting_driver'
    and j.archived_at is null
    and exists (select 1 from profiles dp where dp.id = p_driver_id and dp.role = 'driver' and dp.is_active)
    and is_driver_license_valid(p_driver_id)
    and is_driver_documentation_complete(p_driver_id)
    and (
      not exists (select 1 from preferred_drivers pd where pd.organization_id = j.organization_id)
      or now() > j.created_at + ((select preferred_driver_window_minutes from pricing_settings where id = 1) * interval '1 minute')
      or exists (select 1 from preferred_drivers pd where pd.organization_id = j.organization_id and pd.driver_id = p_driver_id)
    )
    and (
      j.review_approved_at is not null
      or (j.review_claimed_at is null and now() > j.created_at + ((select job_review_hold_minutes from pricing_settings where id = 1) * interval '1 minute'))
      or (
        (j.estimated_distance_km is null or j.estimated_distance_km < (select job_review_hold_min_distance_km from pricing_settings where id = 1))
        and not (j.one_way_flight_back is true and (select job_review_hold_trigger_on_flight from pricing_settings where id = 1))
      )
    )
    and driver_job_ineligibility(p_driver_id, j) is null;
$$;

-- Claim: re-checks everything at claim time (approval, licence, documents,
-- capabilities) plus the coarse overlap check. The precise drive-time
-- conflict check (existing job's drop-off -> this job's pickup) runs in
-- /api/driver/claim-job just before this is called.
create or replace function claim_job_if_no_conflict(p_job_id uuid)
returns jobs language plpgsql security definer as $$
declare
  v_job jobs;
  v_reason text;
  v_start timestamptz;
  v_end timestamptz;
  v_conflict_count int;
  v_has_active_jobs int;
begin
  select * into v_job from jobs where id = p_job_id for update;
  if v_job is null then raise exception 'Job not found.'; end if;

  v_reason := driver_job_ineligibility(auth.uid(), v_job);
  if v_reason is not null then raise exception '%', v_reason; end if;

  if v_job.status <> 'awaiting_driver' then
    raise exception 'This job is no longer available - someone else may have just claimed it.';
  end if;

  select count(*) into v_has_active_jobs
  from jobs where driver_id = auth.uid() and status in ('assigned', 'picked_up', 'in_progress', 'delivered');

  if v_has_active_jobs > 0 then
    if v_job.scheduled_for is null then
      raise exception 'This job has no scheduled time, and you already have an active job - claim it once your current job is finished.';
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
      raise exception 'This job overlaps with a delivery time you already have scheduled - pick one or the other.';
    end if;
  end if;

  update jobs set driver_id = auth.uid(), status = 'assigned' where id = p_job_id returning * into v_job;
  insert into job_status_events (job_id, status, changed_by) values (p_job_id, 'assigned', auth.uid());
  return v_job;
end;
$$;
grant execute on function claim_job_if_no_conflict(uuid) to authenticated;

-- Drivers who should be told about a new job (same rules as above, minus the
-- time-based hold rules so the alert isn't suppressed while a job is in review).
create or replace function get_eligible_driver_ids_for_job(p_job_id uuid)
returns table (driver_id uuid) language sql security definer stable as $$
  select p.id from profiles p, jobs j
  where j.id = p_job_id and p.role = 'driver' and p.is_active
    and driver_job_ineligibility(p.id, j) is null
    and not exists (
      select 1 from jobs mine
      where mine.driver_id = p.id and mine.status in ('assigned', 'picked_up', 'in_progress', 'delivered')
        and j.scheduled_for is not null and mine.scheduled_for is not null
        and j.scheduled_for < mine.scheduled_for + (coalesce(mine.estimated_duration_minutes, 60) * 2 || ' minutes')::interval
        and mine.scheduled_for < j.scheduled_for + (coalesce(j.estimated_duration_minutes, 60) * 2 || ' minutes')::interval
    );
$$;
-- (service role only - called from the server)
revoke all on function get_eligible_driver_ids_for_job(uuid) from public, anon, authenticated;

-- ============================================================
-- 3. In-app notifications for drivers
-- ============================================================
create table if not exists driver_notifications (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references profiles(id) on delete cascade,
  kind text not null,               -- new_job | message | customer_sms
  title text not null,
  body text,
  job_id uuid references jobs(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists driver_notifications_driver_idx on driver_notifications(driver_id, created_at desc);
alter table driver_notifications enable row level security;
create policy "driver reads own notifications" on driver_notifications for select using (driver_id = auth.uid());
create policy "driver updates own notifications" on driver_notifications for update using (driver_id = auth.uid());
grant select, update on driver_notifications to authenticated;
-- realtime for the in-app bell
do $$ begin alter publication supabase_realtime add table driver_notifications; exception when others then null; end $$;

-- ============================================================
-- 4. SMS sending window (8:00 -> admin-adjustable end hour) + ETA bookkeeping
-- ============================================================
alter table pricing_settings add column if not exists sms_window_end_hour int not null default 22;  -- 10 PM, adjustable in admin settings
alter table pending_customer_sms add column if not exists kind text;          -- eta | delay | other
alter table pending_customer_sms add column if not exists superseded_at timestamptz;
alter table pending_customer_sms add column if not exists sent_override_by uuid references profiles(id);   -- driver who chose "send now anyway"
alter table pending_customer_sms add column if not exists sent_override_at timestamptz;
alter table jobs add column if not exists eta_sms_sent_at timestamptz;
alter table jobs add column if not exists delay_sms_sent_at timestamptz;
alter table jobs add column if not exists last_notified_eta timestamptz;

notify pgrst, 'reload schema';
