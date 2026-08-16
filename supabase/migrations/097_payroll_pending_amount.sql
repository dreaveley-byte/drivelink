-- Add the dollar value of pending (not-yet-completed) jobs alongside the
-- count, so admin can see roughly how much more is coming before Monday's
-- payout, not just how many jobs are still in flight.
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
        and updated_at >= p_period_start and updated_at < p_period_end + 1
    ), 0),
    coalesce((
      select count(*) from jobs
      where driver_id = p.id and status = 'completed'
        and updated_at >= p_period_start and updated_at < p_period_end + 1
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
        and updated_at >= p_period_start and updated_at < p_period_end + 1
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
        and updated_at >= date_trunc('month', p_period_start) and updated_at < date_trunc('month', p_period_start) + interval '1 month'
    ), 0)
  from profiles p
  where p.role = 'driver'
  order by p.full_name;
$$;

grant execute on function get_driver_payroll_summary_range(date, date) to authenticated;
