-- Jobs had a DELETE grant (added previously) but no RLS policy permitting
-- delete at all, meaning even admin's delete would silently succeed with
-- zero rows actually removed (RLS defaults to deny when no policy matches
-- the operation) rather than returning a helpful error.
drop policy if exists "admin deletes jobs" on jobs;
create policy "admin deletes jobs" on jobs
for delete using (
  my_role() = 'platform_admin'
);
