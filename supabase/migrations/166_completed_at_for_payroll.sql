-- Real bug behind confusing payroll totals: there was no dedicated
-- "when was this job actually completed" timestamp anywhere - payroll's
-- week/month/year figures were all filtering on updated_at, which changes
-- on ANY edit to the row (an admin adjustment, a pay recompute, a driver
-- reassignment, anything). A job genuinely completed weeks ago that gets
-- touched by an admin action today would jump into "this week's payroll"
-- the moment it's touched, even though nothing about when it was actually
-- completed changed. With how much admin testing has touched jobs
-- recently, this could easily make week/month/year all look identical -
-- not because everything really happened this week, but because
-- everything got RE-TOUCHED this week.
alter table jobs add column if not exists completed_at timestamptz;

-- Set once, the same moment final_driver_pay_cents is (and for the same
-- reason completed_at needs to be - it must never move again after the
-- job is genuinely completed, regardless of later edits).
create or replace function compute_final_driver_pay()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'completed' and (OLD.status is distinct from 'completed') then
    NEW.final_driver_pay_cents := coalesce(NEW.estimated_driver_pay_cents, 0);
    NEW.completed_at := now();
  end if;
  return NEW;
end;
$$;

-- Best-effort backfill for jobs already completed before this column
-- existed: there's no way to recover the real historical completion
-- moment, so this uses updated_at as the closest available proxy - but
-- ONLY for jobs that haven't been touched recently (more than a day
-- before this migration runs), to avoid baking in exactly the same
-- "recently edited, so it looks recent" distortion this migration exists
-- to fix. Jobs edited very recently keep completed_at null rather than
-- getting a plausible-looking but wrong date; recompute_final_driver_pay
-- refreshes completed_at too, so re-running it on a specific job (like
-- the one from this conversation) fixes that job's date along with its
-- pay.
update jobs
set completed_at = updated_at
where status = 'completed'
  and completed_at is null
  and updated_at < now() - interval '1 day';

-- recompute_final_driver_pay already exists (migration 165) - extended
-- here to also refresh completed_at, so re-running it on a job corrects
-- both together.
create or replace function recompute_final_driver_pay(p_job_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update jobs
  set final_driver_pay_cents = coalesce(estimated_driver_pay_cents, 0),
      completed_at = coalesce(completed_at, now())
  where id = p_job_id and status = 'completed';
end;
$$;

-- Payroll now filters on completed_at instead of updated_at.
drop function if exists get_driver_payroll_summary_range(date, date);
create or replace function get_driver_payroll_summary_range(p_period_start date, p_period_end date)
returns table (
  driver_id uuid,
  driver_name text,
  driver_code text,
  week_earnings_cents bigint,
  week_job_count bigint,
  pending_job_count bigint,
  pending_amount_cents bigint,
  outstanding_reimbursements_cents bigint,
  unsettled_draws_cents bigint,
  net_owed_cents bigint,
  month_earnings_cents bigint
)
language sql
security definer
stable
as $$
  select
    p.id,
    p.full_name,
    p.driver_code,
    coalesce((
      select sum(coalesce(final_driver_pay_cents, estimated_driver_pay_cents, 0))
      from jobs
      where driver_id = p.id and status = 'completed'
        and completed_at >= p_period_start and completed_at < p_period_end + 1
    ), 0),
    coalesce((
      select count(*) from jobs
      where driver_id = p.id and status = 'completed'
        and completed_at >= p_period_start and completed_at < p_period_end + 1
    ), 0),
    coalesce((
      select count(*) from jobs
      where driver_id = p.id and status in ('assigned', 'picked_up', 'in_progress', 'delivered')
    ), 0),
    coalesce((
      select sum(coalesce(final_driver_pay_cents, estimated_driver_pay_cents, 0)) from jobs
      where driver_id = p.id and status in ('assigned', 'picked_up', 'in_progress', 'delivered')
    ), 0),
    coalesce((
      select sum(amount_cents) from job_expenses
      where submitted_by = p.id and status = 'approved' and reimbursement_paid_at is null
    ), 0),
    coalesce((
      select sum(amount_cents) from driver_draws
      where driver_id = p.id and settled_at is null
    ), 0),
    coalesce((
      select sum(coalesce(final_driver_pay_cents, estimated_driver_pay_cents, 0))
      from jobs
      where driver_id = p.id and status = 'completed'
        and completed_at >= p_period_start and completed_at < p_period_end + 1
    ), 0)
    + coalesce((
      select sum(amount_cents) from job_expenses
      where submitted_by = p.id and status = 'approved' and reimbursement_paid_at is null
    ), 0)
    - coalesce((
      select sum(amount_cents) from driver_draws
      where driver_id = p.id and settled_at is null
    ), 0),
    coalesce((
      select sum(coalesce(final_driver_pay_cents, estimated_driver_pay_cents, 0))
      from jobs
      where driver_id = p.id and status = 'completed'
        and completed_at >= date_trunc('month', p_period_start) and completed_at < date_trunc('month', p_period_start) + interval '1 month'
    ), 0)
  from profiles p
  where p.role = 'driver'
  order by p.full_name;
$$;

grant execute on function get_driver_payroll_summary_range(date, date) to authenticated;
