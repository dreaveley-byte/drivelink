-- Lets the (unauthenticated) customer chat widget trigger an SMS notification
-- without needing direct table access — same security-definer pattern as the
-- other tracking-token functions.
create or replace function get_job_ids_by_token(p_token uuid)
returns table (job_id uuid, driver_id uuid, organization_id uuid)
language sql stable security definer as $$
  select id, driver_id, organization_id from jobs where tracking_token = p_token;
$$;

grant execute on function get_job_ids_by_token(uuid) to anon, authenticated;
