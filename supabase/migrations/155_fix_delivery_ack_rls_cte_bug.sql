-- Persists a change already applied live while diagnosing the delivery-
-- acknowledgement RLS failure: the driver-ownership check moved into its
-- own function. This wasn't actually the fix (the real cause was that
-- PostgREST's CTE-wrapped INSERT...RETURNING form evaluates this policy
-- incorrectly regardless of how it's written - fixed in code by no longer
-- asking PostgREST to return the row), but it's a harmless, slightly
-- cleaner equivalent to the inline EXISTS version, so keeping it rather
-- than reverting for no reason.
create or replace function is_job_driver(p_job_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from jobs where jobs.id = p_job_id and jobs.driver_id = auth.uid());
$$;

drop policy if exists "drivers record customer delivery acceptance" on legal_acceptances;
create policy "drivers record customer delivery acceptance" on legal_acceptances
  for insert with check (
    application_type = 'customer'
    and job_id is not null
    and is_job_driver(job_id)
  );

-- Removes every piece of temporary scaffolding added while chasing this
-- bug through the Postgres logs - none of it was ever meant to be
-- permanent.
drop trigger if exists debug_before_insert on legal_acceptances;
drop function if exists log_legal_acceptance_debug();
drop table if exists rls_debug_log;
