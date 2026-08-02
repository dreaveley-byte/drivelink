-- Log every time a driver releases a job, and what stage it was in when they did.
create table if not exists job_releases (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  driver_id uuid not null references profiles(id),
  released_from_status text not null,
  released_at timestamptz not null default now()
);

alter table job_releases enable row level security;

drop policy if exists "driver logs own release" on job_releases;
create policy "driver logs own release" on job_releases
  for insert with check (driver_id = auth.uid());

drop policy if exists "admin views all releases" on job_releases;
create policy "admin views all releases" on job_releases
  for select using (my_role() = 'platform_admin');

grant select, insert on job_releases to authenticated;

-- Dealer feedback (left from the dealer's own dashboard, authenticated)
alter table jobs add column if not exists dealer_rating int check (dealer_rating between 1 and 5);
alter table jobs add column if not exists dealer_feedback text;

-- Customer feedback (submitted via the public no-login tracking link)
alter table jobs add column if not exists customer_rating int check (customer_rating between 1 and 5);
alter table jobs add column if not exists customer_feedback text;

-- Lets an anonymous customer submit feedback using only their tracking token —
-- bypasses jobs RLS deliberately, same pattern as get_tracking_info().
create or replace function submit_customer_feedback(p_token uuid, p_rating int, p_feedback text)
returns void language plpgsql security definer as $$
begin
  update jobs set customer_rating = p_rating, customer_feedback = p_feedback
  where tracking_token = p_token;
end;
$$;

grant execute on function submit_customer_feedback(uuid, int, text) to anon, authenticated;

-- Update the tracking RPC (originally from migration 026) to also return whether
-- feedback was already submitted, so the public page doesn't show the form twice.
drop function if exists get_tracking_info(uuid);
create or replace function get_tracking_info(p_token uuid)
returns table (
  status text,
  vehicle_year int,
  vehicle_make text,
  vehicle_model text,
  pickup_address text,
  dropoff_address text,
  driver_lat numeric,
  driver_lng numeric,
  driver_location_updated_at timestamptz,
  estimated_distance_km numeric,
  driver_name text,
  organization_name text,
  customer_rating int
) language sql stable security definer as $$
  select j.status, j.vehicle_year, j.vehicle_make, j.vehicle_model,
         j.pickup_address, j.dropoff_address,
         j.driver_lat, j.driver_lng, j.driver_location_updated_at,
         j.estimated_distance_km,
         p.full_name, o.name, j.customer_rating
  from jobs j
  left join profiles p on p.id = j.driver_id
  left join organizations o on o.id = j.organization_id
  where j.tracking_token = p_token;
$$;

grant execute on function get_tracking_info(uuid) to anon, authenticated;

-- Aggregated per-driver performance stats for the admin dashboard: completed jobs,
-- releases (flagging how many happened after the vehicle was already picked up),
-- checklist completion rate, on-time pickup rate, and average ratings.
create or replace function driver_performance_stats()
returns table (
  driver_id uuid,
  driver_name text,
  total_completed int,
  total_releases int,
  releases_after_pickup int,
  avg_checklist_completion numeric,
  on_time_pickups int,
  total_scheduled_pickups int,
  avg_customer_rating numeric,
  avg_dealer_rating numeric
) language sql stable security definer as $$
  with job_checklist_completion as (
    select job_id,
      count(*) filter (where completed_at is not null)::numeric / nullif(count(*), 0) as completion_pct
    from job_checklist_items
    group by job_id
  ),
  completed as (
    select j.driver_id,
      count(*) as total_completed,
      avg(j.customer_rating) as avg_customer_rating,
      avg(j.dealer_rating) as avg_dealer_rating,
      avg(jcc.completion_pct) as avg_checklist_completion
    from jobs j
    left join job_checklist_completion jcc on jcc.job_id = j.id
    where j.status = 'completed' and j.driver_id is not null
    group by j.driver_id
  ),
  releases as (
    select driver_id,
      count(*) as total_releases,
      count(*) filter (where released_from_status = 'picked_up') as releases_after_pickup
    from job_releases
    group by driver_id
  ),
  timing as (
    select j.driver_id,
      count(*) filter (
        where exists (
          select 1 from job_status_events e
          where e.job_id = j.id and e.status = 'picked_up'
          and e.created_at <= j.scheduled_for + interval '30 minutes'
        )
      ) as on_time_pickups,
      count(*) as total_scheduled_pickups
    from jobs j
    where j.driver_id is not null and j.scheduled_for is not null
      and exists (select 1 from job_status_events e where e.job_id = j.id and e.status = 'picked_up')
    group by j.driver_id
  )
  select p.id, p.full_name,
    coalesce(c.total_completed, 0)::int,
    coalesce(r.total_releases, 0)::int,
    coalesce(r.releases_after_pickup, 0)::int,
    c.avg_checklist_completion,
    coalesce(t.on_time_pickups, 0)::int,
    coalesce(t.total_scheduled_pickups, 0)::int,
    c.avg_customer_rating,
    c.avg_dealer_rating
  from profiles p
  left join completed c on c.driver_id = p.id
  left join releases r on r.driver_id = p.id
  left join timing t on t.driver_id = p.id
  where p.role = 'driver';
$$;

grant execute on function driver_performance_stats() to authenticated;
