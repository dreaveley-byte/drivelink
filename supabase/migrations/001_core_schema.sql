-- DriveLink Core Schema (MVP: post job -> claim job -> update status)
-- Run this in Supabase: SQL Editor -> New Query -> paste -> Run

-- ORGANIZATIONS (dealers/customers who post jobs)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null default 'dealer_customer' check (org_type in ('dealer_customer', 'internal')),
  created_at timestamptz not null default now()
);

-- USER PROFILES (extends Supabase's built-in auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id),
  full_name text,
  role text not null default 'org_member' check (role in ('org_admin', 'org_member', 'driver', 'platform_admin')),
  phone text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- JOB TYPES (admin-configurable list)
create table job_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true
);

insert into job_types (name, description) values
  ('Vehicle Delivery', 'Deliver a vehicle to a customer or another dealer'),
  ('Vehicle Pickup', 'Pick up a vehicle from a customer or another dealer'),
  ('Dealer to Dealer', 'Move a vehicle between dealer locations'),
  ('Courier / Package', 'Deliver paperwork or a package'),
  ('Paperwork Signing', 'Drive to a customer for document signing');

-- JOBS
create table jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  job_type_id uuid not null references job_types(id),
  created_by uuid not null references profiles(id),
  driver_id uuid references profiles(id),

  status text not null default 'awaiting_driver'
    check (status in ('awaiting_driver', 'assigned', 'picked_up', 'in_progress', 'delivered', 'completed', 'cancelled')),

  pickup_address text not null,
  dropoff_address text not null,
  scheduled_for timestamptz,

  recipient_name text,
  recipient_phone text,

  second_driver_required boolean not null default false,
  chase_vehicle_required boolean not null default false,
  is_trade_in_pickup boolean not null default false,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- JOB STATUS EVENTS (audit trail of every status change)
create table job_status_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  status text not null,
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (keeps each org's data private)
-- ============================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table job_types enable row level security;
alter table jobs enable row level security;
alter table job_status_events enable row level security;

-- Helper: get the logged-in user's own profile info without recursion
create or replace function my_org_id()
returns uuid language sql stable security definer as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function my_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- Profiles: users can see their own profile + others in their org
create policy "view own org profiles" on profiles
  for select using (
    id = auth.uid() or organization_id = my_org_id() or my_role() = 'platform_admin'
  );

create policy "update own profile" on profiles
  for update using (id = auth.uid());

-- Organizations: users can see their own org
create policy "view own organization" on organizations
  for select using (
    id = my_org_id() or my_role() = 'platform_admin'
  );

-- Job types: everyone logged in can see the active list
create policy "view job types" on job_types
  for select using (auth.uid() is not null);

-- Jobs: org members see their own org's jobs; drivers see unclaimed jobs + their own claimed jobs; admins see all
create policy "view relevant jobs" on jobs
  for select using (
    organization_id = my_org_id()
    or driver_id = auth.uid()
    or (my_role() = 'driver' and status = 'awaiting_driver')
    or my_role() = 'platform_admin'
  );

create policy "org members create jobs" on jobs
  for insert with check (
    organization_id = my_org_id() and my_role() in ('org_admin', 'org_member')
  );

create policy "drivers claim jobs, org updates own jobs" on jobs
  for update using (
    organization_id = my_org_id()
    or driver_id = auth.uid()
    or (my_role() = 'driver' and status = 'awaiting_driver')
    or my_role() = 'platform_admin'
  );

-- Status events: viewable by anyone who can view the related job
create policy "view job status events" on job_status_events
  for select using (
    job_id in (select id from jobs)
  );

create policy "create job status events" on job_status_events
  for insert with check (auth.uid() is not null);
