create table if not exists job_location_pings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists job_location_pings_job_id_idx on job_location_pings(job_id, created_at);

alter table job_location_pings enable row level security;

drop policy if exists "drivers insert own job pings" on job_location_pings;
create policy "drivers insert own job pings" on job_location_pings
for insert with check (
  exists (select 1 from jobs where id = job_id and driver_id = auth.uid())
);

drop policy if exists "job participants can read pings" on job_location_pings;
create policy "job participants can read pings" on job_location_pings
for select using (
  exists (
    select 1 from jobs j
    left join profiles p on p.id = auth.uid()
    where j.id = job_id
    and (
      j.driver_id = auth.uid()
      or p.role = 'platform_admin'
      or (p.role = 'org_admin' and p.organization_id = j.organization_id)
    )
  )
);

-- Public (token-gated) trail for the customer tracking page — only the portion
-- of the trip driven since the driver actually marked "in progress", not the
-- whole active-job period (which can include time spent at pickup beforehand).
create or replace function get_job_location_trail(p_token uuid)
returns table(lat double precision, lng double precision, recorded_at timestamptz)
language sql
security definer
stable
as $$
  select ping.lat, ping.lng, ping.created_at
  from job_location_pings ping
  join jobs j on j.id = ping.job_id
  where j.tracking_token = p_token
    and ping.created_at >= coalesce(
      (select min(created_at) from job_status_events where job_id = j.id and status = 'in_progress'),
      j.created_at
    )
  order by ping.created_at asc;
$$;
grant execute on function get_job_location_trail(uuid) to anon, authenticated;

-- Same thing, but for the internal admin/dealer tracking page which has a real
-- job id and an authenticated session rather than a public token.
create or replace function get_job_location_trail_by_id(p_job_id uuid)
returns table(lat double precision, lng double precision, recorded_at timestamptz)
language sql
security definer
stable
as $$
  select ping.lat, ping.lng, ping.created_at
  from job_location_pings ping
  where ping.job_id = p_job_id
    and exists (
      select 1 from jobs j
      left join profiles p on p.id = auth.uid()
      where j.id = p_job_id
      and (
        j.driver_id = auth.uid()
        or p.role = 'platform_admin'
        or (p.role = 'org_admin' and p.organization_id = j.organization_id)
      )
    )
    and ping.created_at >= coalesce(
      (select min(created_at) from job_status_events where job_id = p_job_id and status = 'in_progress'),
      (select created_at from jobs where id = p_job_id)
    )
  order by ping.created_at asc;
$$;
grant execute on function get_job_location_trail_by_id(uuid) to authenticated;
