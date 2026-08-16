-- Add week job count and pending (not-yet-completed but active) job count to
-- the payroll summary, so admin can see both how many jobs were actually
-- paid out this week, and what's still in flight that hasn't hit the total yet.
drop function if exists get_driver_payroll_summary(date);
create or replace function get_driver_payroll_summary(p_week_start date)
returns table (
  driver_id uuid,
  driver_name text,
  driver_code text,
  week_earnings_cents bigint,
  week_job_count bigint,
  pending_job_count bigint,
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
        and updated_at >= p_week_start and updated_at < p_week_start + 7
    ), 0),
    coalesce((
      select count(*) from jobs
      where driver_id = p.id and status = 'completed'
        and updated_at >= p_week_start and updated_at < p_week_start + 7
    ), 0),
    coalesce((
      select count(*) from jobs
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
        and updated_at >= p_week_start and updated_at < p_week_start + 7
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
        and updated_at >= date_trunc('month', p_week_start) and updated_at < date_trunc('month', p_week_start) + interval '1 month'
    ), 0)
  from profiles p
  where p.role = 'driver'
  order by p.full_name;
$$;

grant execute on function get_driver_payroll_summary(date) to authenticated;
