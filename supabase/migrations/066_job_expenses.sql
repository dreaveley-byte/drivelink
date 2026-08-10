create table if not exists job_expenses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  category text not null check (category in ('wait_time', 'repairs', 'tolls', 'parking', 'storage', 'additional_mileage', 'other')),
  description text,
  amount_cents int not null check (amount_cents >= 0),
  receipt_photo_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists job_expenses_job_id_idx on job_expenses(job_id);

alter table jobs add column if not exists approved_expenses_cents int not null default 0;

alter table job_expenses enable row level security;

-- Drivers can submit and see their own expense claims on jobs they're driving.
drop policy if exists "drivers manage own job expenses" on job_expenses;
create policy "drivers manage own job expenses" on job_expenses
for all using (
  submitted_by = auth.uid()
  or exists (select 1 from jobs j where j.id = job_id and j.driver_id = auth.uid())
) with check (
  submitted_by = auth.uid()
);

-- Admin (platform-wide) and the job's own dealer (org admin) can view and
-- review (approve/reject) expenses on their jobs.
drop policy if exists "admin and dealer review job expenses" on job_expenses;
create policy "admin and dealer review job expenses" on job_expenses
for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
  or exists (
    select 1 from jobs j
    join profiles p on p.organization_id = j.organization_id
    where j.id = job_id and p.id = auth.uid() and p.role = 'org_admin'
  )
);

grant select, insert, update on job_expenses to authenticated;

-- Private bucket for receipt photos — same pattern as id-verification and job-media.
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "expense receipts insert by driver" on storage.objects;
create policy "expense receipts insert by driver" on storage.objects
for insert with check (
  bucket_id = 'expense-receipts' and auth.uid() is not null
);

drop policy if exists "expense receipts viewable by admin driver dealer" on storage.objects;
create policy "expense receipts viewable by admin driver dealer" on storage.objects
for select using (
  bucket_id = 'expense-receipts'
  and (
    exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
    or exists (
      select 1 from job_expenses e
      join jobs j on j.id = e.job_id
      left join profiles p on p.id = auth.uid()
      where (storage.foldername(storage.objects.name))[1] = e.id::text
      and (
        e.submitted_by = auth.uid()
        or j.driver_id = auth.uid()
        or (p.role = 'org_admin' and p.organization_id = j.organization_id)
      )
    )
  )
);
