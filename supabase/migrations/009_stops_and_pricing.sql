-- Multiple stops per job (pickup, dropoff, and anything in between)
create table job_stops (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  stop_order int not null,
  address text not null,
  stop_type text not null default 'waypoint' check (stop_type in ('pickup', 'waypoint', 'dropoff'))
);

alter table job_stops enable row level security;

create policy "view stops for visible jobs" on job_stops
  for select using (job_id in (select id from jobs));

create policy "create stops for own jobs" on job_stops
  for insert with check (
    job_id in (
      select id from jobs
      where organization_id = my_org_id() or my_role() = 'platform_admin'
    )
  );

grant select, insert on job_stops to authenticated;

-- Distance / cost / pay fields on the job itself
alter table jobs add column estimated_distance_km numeric;
alter table jobs add column estimated_duration_minutes int;
alter table jobs add column estimated_dealer_cost_cents int;
alter table jobs add column estimated_driver_pay_cents int;
alter table jobs add column final_driver_pay_cents int;
