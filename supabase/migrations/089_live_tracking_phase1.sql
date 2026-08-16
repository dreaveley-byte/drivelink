-- Public, token-based access to a job's chat thread and driver rating for
-- the customer tracking page. customer_messages RLS only allows
-- authenticated participants (org/driver/admin), so the anonymous customer
-- viewing via their tracking token needs its own narrow, security-definer
-- path in - never direct table access.

create or replace function get_tracking_messages(p_token uuid)
returns setof customer_messages
language sql
security definer
stable
as $$
  select m.* from customer_messages m
  join jobs j on j.id = m.job_id
  where j.tracking_token = p_token
  order by m.created_at asc;
$$;
grant execute on function get_tracking_messages(uuid) to anon, authenticated;

-- Inserting here is exactly equivalent to the customer texting back the
-- Twilio number - it lands in the same thread, visible to the driver via
-- their existing realtime chat view, without an actual SMS needing to be
-- sent (the driver's chat is Supabase-realtime-driven off this same table).
create or replace function send_tracking_message(p_token uuid, p_body text)
returns customer_messages
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
  v_message customer_messages;
begin
  select id into v_job_id from jobs where tracking_token = p_token;
  if v_job_id is null then
    raise exception 'Invalid tracking link.';
  end if;
  if length(trim(p_body)) = 0 then
    raise exception 'Message cannot be empty.';
  end if;

  insert into customer_messages (job_id, direction, body)
  values (v_job_id, 'from_customer', p_body)
  returning * into v_message;

  return v_message;
end;
$$;
grant execute on function send_tracking_message(uuid, text) to anon, authenticated;

-- Extend get_tracking_info with the driver's overall rating (not just this
-- job's), driver_id (for future use), and job type name (needed to show
-- ride-appropriate text instead of always assuming a vehicle delivery).
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
  job_type_name text
) language sql stable security definer as $$
  select j.status, j.vehicle_year, j.vehicle_make, j.vehicle_model,
         j.pickup_address, j.dropoff_address,
         j.driver_lat, j.driver_lng, j.driver_location_updated_at,
         j.estimated_distance_km, j.estimated_duration_minutes,
         p.id, p.full_name, p.photo_url,
         (select round(avg(customer_rating)::numeric, 1) from jobs where driver_id = p.id and status = 'completed' and customer_rating is not null),
         (select count(customer_rating)::int from jobs where driver_id = p.id and status = 'completed' and customer_rating is not null),
         o.name, o.logo_url, j.customer_rating,
         j.id, jt.name
  from jobs j
  left join profiles p on p.id = j.driver_id
  left join organizations o on o.id = j.organization_id
  left join job_types jt on jt.id = j.job_type_id
  where j.tracking_token = p_token;
$$;

grant execute on function get_tracking_info(uuid) to anon, authenticated;
