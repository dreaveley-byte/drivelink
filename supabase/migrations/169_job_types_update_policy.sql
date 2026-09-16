-- job_types has had row-level security enabled since the very start, but
-- only ever got a SELECT policy and a SELECT grant - there was never an
-- UPDATE policy or grant at all. The Job Types toggle in Admin Settings
-- was therefore being silently rejected on every click: no error surfaced
-- because the toggle's own error handling didn't show one either (fixed
-- in the same commit as this migration), so it just looked like nothing
-- happened.
grant update on job_types to authenticated;

create policy "platform admin manages job types" on job_types
  for update using (my_role() = 'platform_admin');
