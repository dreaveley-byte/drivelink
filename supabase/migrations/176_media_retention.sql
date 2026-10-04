-- Media retention.
--
-- Two separate clocks, deliberately:
--   1. DEALER window (30/60/90 days, set by each dealership): how long after
--      a drive is completed its photos, videos and signatures stay visible in
--      the dealer's own account.
--   2. DRIVFLO archive (2 years): platform admin keeps access to the same
--      stored files for 2 years after completion, then a daily clean-up
--      removes them (see /api/cron/purge-archived-media).
--
-- There is no second physical copy. Files are compressed once, at upload; the
-- dealer window only controls who is allowed to open them. Only media is
-- affected - the job record, pricing and receipt summary stay, and expense
-- receipts are never touched (they're accounting records).

alter table organizations
  add column if not exists media_retention_days int not null default 90;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_media_retention_days_check') then
    alter table organizations
      add constraint organizations_media_retention_days_check
      check (media_retention_days in (30, 60, 90));
  end if;
end $$;

-- Set by the clean-up once a job's files have been removed after the 2-year
-- archive period, so it never retries a job and the receipt can say so.
alter table jobs add column if not exists media_purged_at timestamptz;

-- When the dealer's window closes for a job. Null until the job is
-- completed (nothing is hidden while a drive is still in progress).
create or replace function job_media_expires_at(p_job_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    when j.completed_at is null then null
    else j.completed_at + make_interval(days => o.media_retention_days)
  end
  from jobs j
  join organizations o on o.id = j.organization_id
  where j.id = p_job_id;
$$;

-- Only dealer logins are subject to the window. Drivers and platform admin
-- are never restricted by it.
create or replace function job_media_visible_to_me(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when my_role() in ('org_admin', 'org_member')
      then coalesce(job_media_expires_at(p_job_id) > now(), true)
    else true
  end;
$$;

grant execute on function job_media_expires_at(uuid) to anon, authenticated, service_role;
grant execute on function job_media_visible_to_me(uuid) to anon, authenticated, service_role;

-- Same rule as before (visible if you can see the job), plus the dealer window.
drop policy if exists "view job media for visible jobs" on storage.objects;
create policy "view job media for visible jobs"
on storage.objects for select
using (
  bucket_id = 'job-media'
  and (storage.foldername(name))[1]::uuid in (select id from jobs)
  and job_media_visible_to_me((storage.foldername(name))[1]::uuid)
);

-- Customer ID/face photos follow the same dealer window. Platform admin is
-- unchanged; drivers still never see them.
drop policy if exists "id verification viewable by admin and owning dealer" on storage.objects;
create policy "id verification viewable by admin and owning dealer" on storage.objects
for select using (
  bucket_id = 'id-verification'
  and (
    exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
    or exists (
      select 1 from jobs j
      join profiles p on p.organization_id = j.organization_id
      where p.id = auth.uid() and p.role = 'org_admin'
        and (storage.foldername(storage.objects.name))[1] = j.id::text
        and job_media_visible_to_me(j.id)
    )
  )
);
