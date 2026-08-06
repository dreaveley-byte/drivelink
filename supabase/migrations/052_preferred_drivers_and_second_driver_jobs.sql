-- Preferred drivers: dealers can mark specific drivers as preferred. New jobs
-- go to those drivers first, opening up to everyone after a configurable window.
create table if not exists preferred_drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  driver_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(organization_id, driver_id)
);

alter table preferred_drivers enable row level security;

drop policy if exists "org admins manage own preferred drivers" on preferred_drivers;
create policy "org admins manage own preferred drivers" on preferred_drivers
  for all using (
    organization_id in (select organization_id from profiles where id = auth.uid() and role = 'org_admin')
    or exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
  );

drop policy if exists "drivers can see if they are preferred" on preferred_drivers;
create policy "drivers can see if they are preferred" on preferred_drivers
  for select using (driver_id = auth.uid());

alter table pricing_settings add column if not exists preferred_driver_window_minutes int not null default 10;

-- Returns jobs visible to a given driver: if an org has preferred drivers set,
-- a fresh job is only visible to those drivers until the window elapses, then
-- it opens up to everyone. Orgs with no preferred drivers behave as before.
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
    );
$$;
grant execute on function get_available_jobs_for_driver(uuid) to authenticated;

-- Second-driver companion jobs: a distinct, independently claimable job post
-- for the 2nd driver on a job, linked back to the primary job.
alter table jobs add column if not exists is_second_driver_job boolean not null default false;
