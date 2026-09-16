-- final_driver_pay_cents only ever gets set once, at the exact moment a
-- job's status first transitions to 'completed' (see
-- compute_final_driver_pay(), migration 151) - it is never revisited
-- after that, even if estimated_driver_pay_cents or
-- admin_pay_override_cents change later for any reason. If a job is
-- marked completed at a point when its pay estimate isn't in place yet
-- (e.g. completed out of the normal driver flow, before pricing was
-- fully set), that stale figure - $0, in the case that surfaced this -
-- is locked in permanently with nothing to correct it.
--
-- This gives an explicit way to recompute it on demand, same pattern as
-- recompute_job_expense_additions - safe to call on any job (a no-op
-- unless it's actually completed).
create or replace function recompute_final_driver_pay(p_job_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update jobs
  set final_driver_pay_cents = coalesce(estimated_driver_pay_cents, 0)
  where id = p_job_id and status = 'completed';
end;
$$;

grant execute on function recompute_final_driver_pay(uuid) to authenticated;

-- Fixes the specific job that surfaced this.
select recompute_final_driver_pay('c67ce5da-af78-42a3-9042-590c34cdceb2');
