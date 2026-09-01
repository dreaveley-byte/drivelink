-- Fixes the same double-counting bug just found and fixed on the receipt
-- page: food expenses are already fully baked into driver pay via a
-- dedicated trigger (compute_final_driver_pay, migration 118) that
-- reimburses actual food spend dollar-for-dollar (plus a 50% efficiency
-- bonus on any unspent baseline) directly into final_driver_pay_cents.
-- Summing food again here on top of driver pay double-counted every food
-- receipt, overstating actual cost and understating profit by that amount.
create or replace function get_dealer_summary_range(p_period_start date, p_period_end date)
returns table (
  organization_id uuid,
  total_drives bigint,
  total_revenue_cents bigint,
  total_profit_cents bigint,
  outstanding_debt_cents bigint
)
language sql
stable
as $$
  with job_expense_totals as (
    select
      job_id,
      coalesce(sum(approved_addition_cents), 0) as approved_additions_cents,
      coalesce(sum(amount_cents) filter (where status = 'approved' and category <> 'food'), 0) as approved_full_amount_cents
    from job_expenses
    group by job_id
  ),
  job_financials as (
    select
      j.id,
      j.organization_id,
      j.updated_at,
      j.dealer_paid_at,
      coalesce(j.estimated_dealer_cost_cents, 0) + coalesce(jet.approved_additions_cents, 0) as revenue_cents,
      coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0)
        + coalesce(jet.approved_full_amount_cents, 0) as actual_cost_cents
    from jobs j
    left join job_expense_totals jet on jet.job_id = j.id
    where j.status = 'completed'
  )
  select
    o.id as organization_id,
    count(jf.id) filter (where jf.updated_at::date between p_period_start and p_period_end) as total_drives,
    coalesce(sum(jf.revenue_cents) filter (where jf.updated_at::date between p_period_start and p_period_end), 0) as total_revenue_cents,
    coalesce(sum(jf.revenue_cents - jf.actual_cost_cents) filter (where jf.updated_at::date between p_period_start and p_period_end), 0) as total_profit_cents,
    coalesce(sum(jf.revenue_cents) filter (where jf.dealer_paid_at is null), 0) as outstanding_debt_cents
  from organizations o
  left join job_financials jf on jf.organization_id = o.id
  group by o.id;
$$;

grant execute on function get_dealer_summary_range(date, date) to authenticated;

drop function if exists get_dealer_drive_details(uuid, date, date);

create or replace function get_dealer_drive_details(p_organization_id uuid, p_period_start date, p_period_end date)
returns table (
  job_id uuid,
  driver_name text,
  scheduled_for timestamptz,
  booked_hours numeric,
  booked_hours_is_estimate boolean,
  actual_driver_hours numeric,
  driver_pay_cents bigint,
  in_progress_at timestamptz,
  completed_at timestamptz,
  total_cost_cents bigint,
  total_charged_cents bigint,
  profit_cents bigint
)
language sql
stable
as $$
  with job_expense_totals as (
    select
      job_id,
      coalesce(sum(approved_addition_cents), 0) as approved_additions_cents,
      coalesce(sum(amount_cents) filter (where status = 'approved' and category <> 'food'), 0) as approved_full_amount_cents
    from job_expenses
    group by job_id
  ),
  in_progress_events as (
    select distinct on (job_id) job_id, created_at as in_progress_at
    from job_status_events
    where status = 'in_progress'
    order by job_id, created_at asc
  ),
  completed_events as (
    select distinct on (job_id) job_id, created_at as completed_at
    from job_status_events
    where status = 'completed'
    order by job_id, created_at desc
  )
  select
    j.id as job_id,
    p.full_name as driver_name,
    j.scheduled_for,
    coalesce(j.driver_paid_hours, j.estimated_duration_minutes / 60.0) as booked_hours,
    j.driver_paid_hours is null as booked_hours_is_estimate,
    j.actual_driver_hours,
    coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0) as driver_pay_cents,
    ipe.in_progress_at,
    ce.completed_at,
    (coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0)
      + coalesce(jet.approved_full_amount_cents, 0)) as total_cost_cents,
    (coalesce(j.estimated_dealer_cost_cents, 0) + coalesce(jet.approved_additions_cents, 0)) as total_charged_cents,
    (coalesce(j.estimated_dealer_cost_cents, 0) + coalesce(jet.approved_additions_cents, 0))
      - (coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0)
        + coalesce(jet.approved_full_amount_cents, 0)) as profit_cents
  from jobs j
  left join profiles p on p.id = j.driver_id
  left join job_expense_totals jet on jet.job_id = j.id
  left join in_progress_events ipe on ipe.job_id = j.id
  left join completed_events ce on ce.job_id = j.id
  where j.organization_id = p_organization_id
    and j.status = 'completed'
    and j.updated_at::date between p_period_start and p_period_end
  order by j.updated_at desc;
$$;

grant execute on function get_dealer_drive_details(uuid, date, date) to authenticated;
