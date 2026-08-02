alter table job_checklist_items add column if not exists item_type text not null default 'check';
alter table job_checklist_items add column if not exists file_paths text[] not null default '{}';

-- Private bucket for pickup/delivery evidence: condition photos, walk-around video,
-- registration/safety uploads, and signature captures.
insert into storage.buckets (id, name, public)
values ('job-media', 'job-media', false)
on conflict (id) do nothing;

-- Files are stored under a folder named after the job id. Visibility follows the
-- same rules as the job itself (driver assigned, dealer's own org, or admin) by
-- reusing the "view relevant jobs" RLS on the jobs table.
create policy "view job media for visible jobs"
on storage.objects for select
using (
  bucket_id = 'job-media'
  and (storage.foldername(name))[1]::uuid in (select id from jobs)
);

create policy "driver uploads job media for own claimed job"
on storage.objects for insert
with check (
  bucket_id = 'job-media'
  and (
    (storage.foldername(name))[1]::uuid in (select id from jobs where driver_id = auth.uid())
    or my_role() = 'platform_admin'
  )
);
