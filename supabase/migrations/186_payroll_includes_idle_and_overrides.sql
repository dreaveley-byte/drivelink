-- Payroll was missing idle-time pay. The receipt computes driver pay as
-- (admin_pay_override ?? final ?? estimated) + admin idle-hours driver pay +
-- timer idle fee, but this summary only used final/estimated, so drives with
-- added idle time (or an admin pay override) came up short on the payroll page.
-- Same pay expression as the receipt, everywhere payroll sums job pay.
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
      select sum(coalesce(admin_pay_override_cents, final_driver_pay_cents, estimated_driver_pay_cents, 0) + coalesce(admin_idle_hours_driver_cents, 0) + coalesce(idle_fee_cents, 0) + coalesce(performance_bonus_override_cents, case when performance_bonus_eligible then performance_bonus_cents else 0 end, 0))
      from jobs
      where driver_id = p.id and status = 'completed' and archived_at is null
        and completed_at >= p_period_start and completed_at < p_period_end + 1
    ), 0),
    coalesce((
      select count(*) from jobs
      where driver_id = p.id and status = 'completed' and archived_at is null
        and completed_at >= p_period_start and completed_at < p_period_end + 1
    ), 0),
    coalesce((
      select count(*) from jobs
      where driver_id = p.id and status in ('assigned', 'picked_up', 'in_progress', 'delivered') and archived_at is null
    ), 0),
    coalesce((
      select sum(coalesce(admin_pay_override_cents, final_driver_pay_cents, estimated_driver_pay_cents, 0) + coalesce(admin_idle_hours_driver_cents, 0) + coalesce(idle_fee_cents, 0) + coalesce(performance_bonus_override_cents, case when performance_bonus_eligible then performance_bonus_cents else 0 end, 0)) from jobs
      where driver_id = p.id and status in ('assigned', 'picked_up', 'in_progress', 'delivered') and archived_at is null
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
      select sum(coalesce(admin_pay_override_cents, final_driver_pay_cents, estimated_driver_pay_cents, 0) + coalesce(admin_idle_hours_driver_cents, 0) + coalesce(idle_fee_cents, 0) + coalesce(performance_bonus_override_cents, case when performance_bonus_eligible then performance_bonus_cents else 0 end, 0))
      from jobs
      where driver_id = p.id and status = 'completed' and archived_at is null
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
      select sum(coalesce(admin_pay_override_cents, final_driver_pay_cents, estimated_driver_pay_cents, 0) + coalesce(admin_idle_hours_driver_cents, 0) + coalesce(idle_fee_cents, 0) + coalesce(performance_bonus_override_cents, case when performance_bonus_eligible then performance_bonus_cents else 0 end, 0))
      from jobs
      where driver_id = p.id and status = 'completed' and archived_at is null
        and completed_at >= date_trunc('month', p_period_start) and completed_at < date_trunc('month', p_period_start) + interval '1 month'
    ), 0)
  from profiles p
  where p.role = 'driver'
  order by p.full_name;
$$;

grant execute on function get_driver_payroll_summary_range(date, date) to authenticated;
