-- Fixes both dealer RPCs to respect performance_bonus_eligible now that
-- performance_bonus_cents is always the POTENTIAL amount (see migration
-- 149) - only counts as a real cost when eligible, or when admin has
-- explicitly overridden it (which always wins regardless of eligibility).
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
      coalesce(sum(amount_cents) filter (where status = 'approved'), 0) as approved_full_amount_cents
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
        + coalesce(jet.approved_full_amount_cents, 0)
        + coalesce(j.performance_bonus_override_cents, case when j.performance_bonus_eligible then j.performance_bonus_cents else 0 end, 0) as actual_cost_cents
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
  performance_bonus_cents bigint,
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
      coalesce(sum(amount_cents) filter (where status = 'approved'), 0) as approved_full_amount_cents
    from job_expenses
    group by job_id
  ),
  job_bonus as (
    select
      id as job_id,
      coalesce(performance_bonus_override_cents, case when performance_bonus_eligible then performance_bonus_cents else 0 end, 0) as effective_bonus_cents
    from jobs
  )
  select
    j.id as job_id,
    p.full_name as driver_name,
    j.scheduled_for,
    coalesce(j.driver_paid_hours, j.estimated_duration_minutes / 60.0) as booked_hours,
    j.driver_paid_hours is null as booked_hours_is_estimate,
    j.actual_driver_hours,
    coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0) as driver_pay_cents,
    jb.effective_bonus_cents as performance_bonus_cents,
    (select created_at from job_status_events where job_id = j.id and status = 'in_progress' order by created_at asc limit 1) as in_progress_at,
    (select created_at from job_status_events where job_id = j.id and status = 'completed' order by created_at desc limit 1) as completed_at,
    (coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0)
      + coalesce(jet.approved_full_amount_cents, 0)
      + jb.effective_bonus_cents) as total_cost_cents,
    (coalesce(j.estimated_dealer_cost_cents, 0) + coalesce(jet.approved_additions_cents, 0)) as total_charged_cents,
    (coalesce(j.estimated_dealer_cost_cents, 0) + coalesce(jet.approved_additions_cents, 0))
      - (coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0)
        + coalesce(jet.approved_full_amount_cents, 0)
        + jb.effective_bonus_cents) as profit_cents
  from jobs j
  left join profiles p on p.id = j.driver_id
  left join job_expense_totals jet on jet.job_id = j.id
  left join job_bonus jb on jb.job_id = j.id
  where j.organization_id = p_organization_id
    and j.status = 'completed'
    and j.updated_at::date between p_period_start and p_period_end
  order by j.updated_at desc;
$$;

grant execute on function get_dealer_drive_details(uuid, date, date) to authenticated;
