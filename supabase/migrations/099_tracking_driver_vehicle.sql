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
  estimated_duration_minutes numeric,
  driver_id uuid,
  driver_name text,
  driver_photo_url text,
  driver_avg_rating numeric,
  driver_rating_count int,
  organization_name text,
  organization_logo_url text,
  customer_rating int,
  job_id uuid,
  job_type_name text,
  package_description text,
  driver_vehicle_photo_url text,
  driver_vehicle_year int,
  driver_vehicle_make text,
  driver_vehicle_model text
) language sql stable security definer as $$
  select j.status, j.vehicle_year, j.vehicle_make, j.vehicle_model,
         j.pickup_address, j.dropoff_address,
         j.driver_lat, j.driver_lng, j.driver_location_updated_at,
         j.estimated_distance_km, j.estimated_duration_minutes,
         p.id, p.full_name, p.photo_url,
         (select round(avg(customer_rating)::numeric, 1) from jobs where driver_id = p.id and status = 'completed' and customer_rating is not null),
         (select count(customer_rating)::int from jobs where driver_id = p.id and status = 'completed' and customer_rating is not null),
         o.name, o.logo_url, j.customer_rating,
         j.id, jt.name, j.package_description,
         p.vehicle_photo_url, p.vehicle_year, p.vehicle_make, p.vehicle_model
  from jobs j
  left join profiles p on p.id = j.driver_id
  left join organizations o on o.id = j.organization_id
  left join job_types jt on jt.id = j.job_type_id
  where j.tracking_token = p_token;
$$;

grant execute on function get_tracking_info(uuid) to anon, authenticated;
