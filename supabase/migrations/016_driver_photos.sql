-- Public bucket for driver profile photos (headshots only — not sensitive documents)
insert into storage.buckets (id, name, public)
values ('driver-photos', 'driver-photos', true)
on conflict (id) do nothing;

-- Anyone can view (bucket is public), but only the driver themselves or an admin can upload/replace
create policy "anyone can view driver photos"
on storage.objects for select
using (bucket_id = 'driver-photos');

create policy "drivers and admins manage driver photos"
on storage.objects for insert
with check (
  bucket_id = 'driver-photos'
  and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
);

create policy "drivers and admins update driver photos"
on storage.objects for update
using (
  bucket_id = 'driver-photos'
  and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
);

-- Let a dealer see the profile (name/photo) of a driver currently assigned to one of their own jobs
create policy "dealers view assigned driver profile" on profiles
  for select using (
    role = 'driver'
    and id in (select driver_id from jobs where organization_id = my_org_id() and driver_id is not null)
  );
