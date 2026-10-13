-- Admin lookup of a drive by the short ID shown on receipts (the first 8
-- characters of the full ID) - or by any longer piece of it, with or without
-- the dashes. Returns up to 10 matches so an (extremely unlikely) short-ID
-- collision can be resolved by the person looking it up.
create or replace function find_jobs_by_short_id(p_ref text)
returns table (
  id uuid,
  status text,
  organization_name text,
  pickup_address text,
  dropoff_address text,
  vehicle text
)
language sql
security definer
stable
set search_path = public
as $$
  with cleaned as (
    select lower(regexp_replace(coalesce(p_ref, ''), '[^0-9a-fA-F]', '', 'g')) as ref
  )
  select
    j.id,
    j.status::text,
    o.name,
    j.pickup_address,
    j.dropoff_address,
    nullif(trim(concat_ws(' ', j.vehicle_year::text, j.vehicle_make, j.vehicle_model)), '')
  from jobs j
  left join organizations o on o.id = j.organization_id
  cross join cleaned c
  where my_role() = 'platform_admin'
    and length(c.ref) >= 6
    and replace(j.id::text, '-', '') like c.ref || '%'
  order by j.created_at desc
  limit 10;
$$;

grant execute on function find_jobs_by_short_id(text) to authenticated;

notify pgrst, 'reload schema';
