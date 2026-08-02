alter table jobs add column if not exists tracking_token uuid not null default gen_random_uuid();
create unique index if not exists jobs_tracking_token_idx on jobs(tracking_token);

-- Returns only what a customer needs to see their delivery's live status —
-- no cost, VIN, stock number, or other sensitive fields. security definer lets
-- this bypass the normal jobs RLS, since anonymous visitors have no login at all;
-- the token itself is the access control.
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
  organization_name text
) language sql stable security definer as $$
  select j.status, j.vehicle_year, j.vehicle_make, j.vehicle_model,
         j.pickup_address, j.dropoff_address,
         j.driver_lat, j.driver_lng, j.driver_location_updated_at,
         j.estimated_distance_km,
         p.full_name, o.name
  from jobs j
  left join profiles p on p.id = j.driver_id
  left join organizations o on o.id = j.organization_id
  where j.tracking_token = p_token;
$$;

grant execute on function get_tracking_info(uuid) to anon, authenticated;
