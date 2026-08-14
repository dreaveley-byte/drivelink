alter table profiles add column if not exists driver_code text unique;

create sequence if not exists driver_code_seq start with 1001;

-- Generates the next sequential Driver ID in the form DRV-1001, DRV-1002, etc.
create or replace function generate_driver_code()
returns text
language sql
as $$
  select 'DRV-' || nextval('driver_code_seq')::text;
$$;

grant usage on sequence driver_code_seq to authenticated;
grant execute on function generate_driver_code() to authenticated;

-- Re-define the public profile function (from migration 085) to also
-- include driver_code, now that the column exists.
create or replace function get_driver_public_profile(p_driver_id uuid)
returns table(full_name text, photo_url text, is_active boolean, driver_code text)
language sql
security definer
stable
as $$
  select full_name, photo_url, is_active, driver_code
  from profiles
  where id = p_driver_id and role = 'driver';
$$;
grant execute on function get_driver_public_profile(uuid) to anon, authenticated;
