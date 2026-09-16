-- New driver capability/preference fields, on both driver_applications (the
-- original submission) and profiles (mirrored at approval time, same
-- pattern as license_class/can_tow_trailer/preferred_job_types already
-- use) - profiles is what actually needs to exist for job-matching, since
-- that has to work for an ongoing active driver, not just at application
-- time.
alter table driver_applications add column if not exists transmission_capability text check (transmission_capability in ('automatic', 'manual', 'both'));
alter table driver_applications add column if not exists trailer_towing_experience boolean;
alter table driver_applications add column if not exists vehicle_tow_capacity_lbs int;
alter table driver_applications add column if not exists max_drive_range_km int;

alter table profiles add column if not exists transmission_capability text check (transmission_capability in ('automatic', 'manual', 'both'));
alter table profiles add column if not exists trailer_towing_experience boolean;
alter table profiles add column if not exists vehicle_tow_capacity_lbs int;
alter table profiles add column if not exists max_drive_range_km int;

-- Filters jobs a driver can't actually take, on top of the existing
-- review-hold/preferred-driver logic. Deliberately backward-compatible:
-- a driver who hasn't filled in a given field yet (null) is NOT filtered
-- out by it - only an explicit stated limitation ('automatic' only,
-- can_tow_trailer = false, or a set max range) excludes a job. Otherwise
-- every existing driver would suddenly lose access to jobs the moment
-- this deployed, just for not having answered a question that didn't
-- exist yet when they applied.
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
      j.review_approved_at is not null
      or (
        j.review_claimed_at is null
        and now() > j.created_at + ((select job_review_hold_minutes from pricing_settings where id = 1) * interval '1 minute')
      )
      or (
        (j.estimated_distance_km is null or j.estimated_distance_km < (select job_review_hold_min_distance_km from pricing_settings where id = 1))
        and not (j.one_way_flight_back is true and (select job_review_hold_trigger_on_flight from pricing_settings where id = 1))
      )
    )
    and not exists (
      select 1 from profiles p
      where p.id = p_driver_id
        and (
          (p.transmission_capability = 'automatic' and (j.vehicle_transmission = 'manual' or j.second_vehicle_transmission = 'manual'))
          or (p.can_tow_trailer = false and j.vehicle_mode = 'towed')
          or (p.max_drive_range_km is not null and j.estimated_distance_km is not null and j.estimated_distance_km > p.max_drive_range_km)
        )
    );
$$;
