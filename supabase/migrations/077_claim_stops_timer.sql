-- Once admin claims a held job for review, the auto-release-after-timer
-- behavior stops entirely — from that point on, only an explicit approval
-- releases it to drivers, no matter how much time passes. Before this, a
-- claimed job could still silently go live on its own once the timer ran
-- out, even though someone was actively reviewing it.
drop policy if exists "view relevant jobs" on jobs;
create policy "view relevant jobs" on jobs
  for select using (
    organization_id = my_org_id()
    or driver_id = auth.uid()
    or (
      my_role() = 'driver' and status = 'awaiting_driver'
      and (
        review_approved_at is not null
        or (
          review_claimed_at is null
          and now() > created_at + ((select job_review_hold_minutes from pricing_settings where id = 1) * interval '1 minute')
        )
        or (
          (estimated_distance_km is null or estimated_distance_km < (select job_review_hold_min_distance_km from pricing_settings where id = 1))
          and not (one_way_flight_back is true and (select job_review_hold_trigger_on_flight from pricing_settings where id = 1))
        )
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
        review_approved_at is not null
        or (
          review_claimed_at is null
          and now() > created_at + ((select job_review_hold_minutes from pricing_settings where id = 1) * interval '1 minute')
        )
        or (
          (estimated_distance_km is null or estimated_distance_km < (select job_review_hold_min_distance_km from pricing_settings where id = 1))
          and not (one_way_flight_back is true and (select job_review_hold_trigger_on_flight from pricing_settings where id = 1))
        )
      )
    )
    or my_role() = 'platform_admin'
  );

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
    );
$$;
grant execute on function get_available_jobs_for_driver(uuid) to authenticated;
