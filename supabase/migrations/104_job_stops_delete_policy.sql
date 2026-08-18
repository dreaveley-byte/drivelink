create policy "delete stops for own jobs" on job_stops
  for delete using (
    job_id in (
      select id from jobs
      where organization_id = my_org_id() or my_role() = 'platform_admin'
    )
  );

grant delete on job_stops to authenticated;
