-- This policy already exists in migrations/114_legal_documents.sql, but the
-- production error ("new row-level security policy for table
-- legal_acceptances") confirms it was never actually created on the live
-- database - likely added to that file after the rest of it had already
-- been run. Without it, a customer's delivery acknowledgement (which has no
-- user_id, since customers have no account) falls through to the generic
-- "users insert own legal acceptances" policy, which requires
-- user_id = auth.uid() and therefore always rejects it.
drop policy if exists "drivers record customer delivery acceptance" on legal_acceptances;

create policy "drivers record customer delivery acceptance" on legal_acceptances
  for insert with check (
    application_type = 'customer'
    and job_id is not null
    and exists (select 1 from jobs where jobs.id = job_id and jobs.driver_id = auth.uid())
  );
