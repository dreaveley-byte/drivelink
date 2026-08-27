-- Per-dealer summary for a given date range: total completed drives,
-- total revenue (what they were charged), total profit (using the same
-- revenue/actual-cost/profit formula already used on the individual job
-- receipt page), and outstanding debt (completed jobs not yet marked
-- dealer-paid), all in one query rather than fetching every job and every
-- job_expenses row client-side and aggregating in JS.
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
      coalesce(sum(approved_addition_cents), 0) as approved_additions_cents
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
        + coalesce(j.estimated_driver_reimbursement_cents, 0)
        + coalesce(jet.approved_additions_cents, 0) as actual_cost_cents
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
