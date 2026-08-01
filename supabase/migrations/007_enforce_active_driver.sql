create or replace function my_is_active()
returns boolean language sql stable security definer as $$
  select coalesce(is_active, true) from profiles where id = auth.uid();
$$;

drop policy "drivers claim jobs, org updates own jobs" on jobs;

create policy "drivers claim jobs, org updates own jobs" on jobs
  for update using (
    organization_id = my_org_id()
    or driver_id = auth.uid()
    or (my_role() = 'driver' and status = 'awaiting_driver' and my_is_active())
    or my_role() = 'platform_admin'
  );
