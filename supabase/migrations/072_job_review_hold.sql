-- Admin review hold: a long-haul job posted by a dealer isn't visible to
-- drivers for a configurable window, giving admin a chance to catch a bad
-- quote (e.g. a mispriced flight/ground-transport leg) before a driver can
-- accept it. Only applies to jobs at/above a configurable distance — short
-- local jobs go live immediately, same as before. Admin can "approve" a job
-- early to release it before the hold elapses, or just let the timer run out.
alter table pricing_settings add column if not exists job_review_hold_minutes int not null default 5;
alter table pricing_settings add column if not exists job_review_hold_min_distance_km numeric not null default 400;

alter table jobs add column if not exists review_claimed_by uuid references profiles(id);
alter table jobs add column if not exists review_claimed_at timestamptz;
alter table jobs add column if not exists review_approved_at timestamptz;
alter table jobs add column if not exists review_approved_by uuid references profiles(id);

-- Same visibility gate, enforced at the RLS layer (this is what actually
-- blocks/allows a direct claim attempt, not just the listing RPC below).
drop policy if exists "view relevant jobs" on jobs;
create policy "view relevant jobs" on jobs
  for select using (
    organization_id = my_org_id()
    or driver_id = auth.uid()
    or (
      my_role() = 'driver' and status = 'awaiting_driver'
      and (
        estimated_distance_km is null
        or estimated_distance_km < (select job_review_hold_min_distance_km from pricing_settings where id = 1)
        or review_approved_at is not null
        or now() > created_at + ((select job_review_hold_minutes from pricing_settings where id = 1) * interval '1 minute')
      )
    )
    or my_role() = 'platform_admin'
  );

drop policy if exists "drivers claim jobs, org updates own jobs" on jobs;
create policy "drivers claim jobs, org updates own jobs" on jobs
  for update using (
    organization_id = my_org_id()
    or driver_id = auth.uid()
    or (
      my_role() = 'driver' and status = 'awaiting_driver'
      and (
        estimated_distance_km is null
        or estimated_distance_km < (select job_review_hold_min_distance_km from pricing_settings where id = 1)
        or review_approved_at is not null
        or now() > created_at + ((select job_review_hold_minutes from pricing_settings where id = 1) * interval '1 minute')
      )
    )
    or my_role() = 'platform_admin'
  );

-- Same hold condition applied to the driver job-listing RPC (mirrors the
-- preferred-drivers window added in 052_preferred_drivers_and_second_driver_jobs.sql).
create or replace function get_available_jobs_for_driver(p_driver_id uuid)
returns setof jobs
language sql
security definer
stable
as $$
  select j.* from jobs j
  where j.status = 'awaiting_driver'
    and j.archived_at is null
    and (
      not exists (select 1 from preferred_drivers pd where pd.organization_id = j.organization_id)
      or now() > j.created_at + (
        (select preferred_driver_window_minutes from pricing_settings where id = 1) * interval '1 minute'
      )
      or exists (
        select 1 from preferred_drivers pd
        where pd.organization_id = j.organization_id and pd.driver_id = p_driver_id
      )
    )
    and (
      j.estimated_distance_km is null
      or j.estimated_distance_km < (select job_review_hold_min_distance_km from pricing_settings where id = 1)
      or j.review_approved_at is not null
      or now() > j.created_at + ((select job_review_hold_minutes from pricing_settings where id = 1) * interval '1 minute')
    );
$$;
grant execute on function get_available_jobs_for_driver(uuid) to authenticated;
