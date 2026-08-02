create table if not exists job_checklist_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  label text not null,
  sort_order int not null,
  completed_at timestamptz,
  completed_by uuid references profiles(id)
);

alter table job_checklist_items enable row level security;

create policy "view checklist for visible jobs" on job_checklist_items
  for select using (job_id in (select id from jobs));

create policy "driver creates checklist for own claimed job" on job_checklist_items
  for insert with check (
    job_id in (select id from jobs where driver_id = auth.uid())
    or my_role() = 'platform_admin'
  );

create policy "driver updates own job checklist" on job_checklist_items
  for update using (
    job_id in (select id from jobs where driver_id = auth.uid())
    or my_role() = 'platform_admin'
  );

grant select, insert, update on job_checklist_items to authenticated;
