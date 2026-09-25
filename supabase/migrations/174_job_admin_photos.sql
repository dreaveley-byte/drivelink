-- Lets admin attach extra photos to a job after the fact (registration
-- documents, etc.) that aren't part of the driver's own checklist -
-- separate from job_checklist_items since these are admin-added, not
-- something the driver filled in as part of their own workflow.
create table job_admin_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  storage_path text not null,
  caption text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table job_admin_photos enable row level security;

-- Same visibility pattern as job-media storage itself: anyone who can see
-- the underlying job (driver assigned, the job's own dealer org, or
-- admin) can see these too - the "in (select id from jobs)" subquery is
-- itself subject to the jobs table's own RLS, so it naturally scopes to
-- exactly the jobs this user is already allowed to see.
create policy "view admin photos for visible jobs" on job_admin_photos
  for select using (job_id in (select id from jobs));

create policy "admin manages job photos" on job_admin_photos
  for insert with check (my_role() = 'platform_admin');

create policy "admin deletes job photos" on job_admin_photos
  for delete using (my_role() = 'platform_admin');

grant select on job_admin_photos to authenticated;
grant insert, delete on job_admin_photos to authenticated;
