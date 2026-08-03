-- Dealer business logo / face photo (shown to drivers, admin, and on the customer tracking page)
alter table organizations add column if not exists logo_url text;

-- Allow applicants to keep editing their own application after approval (previously
-- locked to status = 'pending', which meant nobody could ever update their info again).
drop policy if exists "drivers update own pending application" on driver_applications;
create policy "drivers update own application" on driver_applications
  for update using (user_id = auth.uid() or my_role() = 'platform_admin');

drop policy if exists "org members update own pending application" on dealer_applications;
create policy "org members update own application" on dealer_applications
  for update using (submitted_by = auth.uid() or organization_id = my_org_id() or my_role() = 'platform_admin');

-- Public bucket for dealer logos/photos (mirrors the driver-photos bucket)
insert into storage.buckets (id, name, public)
values ('dealer-logos', 'dealer-logos', true)
on conflict (id) do nothing;

drop policy if exists "org members manage own logo" on storage.objects;
create policy "org members upload own logo" on storage.objects
  for insert with check (
    bucket_id = 'dealer-logos'
    and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
  );

create policy "org members update own logo" on storage.objects
  for update using (
    bucket_id = 'dealer-logos'
    and (auth.uid()::text = (storage.foldername(name))[1] or my_role() = 'platform_admin')
  );

drop policy if exists "anyone can view dealer logos" on storage.objects;
create policy "anyone can view dealer logos" on storage.objects
  for select using (bucket_id = 'dealer-logos');

-- Include driver photo in the public tracking RPC so the customer can see their driver's face
drop function if exists get_tracking_info(uuid);
create or replace function get_tracking_info(p_token uuid)
returns table (
  status text,
  vehicle_year int,
  vehicle_make text,
  vehicle_model text,
  pickup_address text,
  dropoff_address text,
  driver_lat numeric,
  driver_lng numeric,
  driver_location_updated_at timestamptz,
  estimated_distance_km numeric,
  driver_name text,
  driver_photo_url text,
  organization_name text,
  organization_logo_url text,
  customer_rating int
) language sql stable security definer as $$
  select j.status, j.vehicle_year, j.vehicle_make, j.vehicle_model,
         j.pickup_address, j.dropoff_address,
         j.driver_lat, j.driver_lng, j.driver_location_updated_at,
         j.estimated_distance_km,
         p.full_name, p.photo_url, o.name, o.logo_url, j.customer_rating
  from jobs j
  left join profiles p on p.id = j.driver_id
  left join organizations o on o.id = j.organization_id
  where j.tracking_token = p_token;
$$;

grant execute on function get_tracking_info(uuid) to anon, authenticated;
