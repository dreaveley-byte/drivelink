-- Grant baseline table access to logged-in users
-- (RLS policies still control which specific ROWS they can see/change)

grant usage on schema public to authenticated;

grant select, insert, update on organizations to authenticated;
grant select, insert, update on profiles to authenticated;
grant select on job_types to authenticated;
grant select, insert, update on jobs to authenticated;
grant select, insert on job_status_events to authenticated;
