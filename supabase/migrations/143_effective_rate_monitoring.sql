-- Adds the fields needed to flag jobs where a driver's real per-hour
-- earnings fell meaningfully below what the job was priced to pay them,
-- for at-a-glance monitoring across many drives rather than checking one
-- job's receipt at a time. driver_pay_cents is separated out from
-- total_cost_cents (which also includes expense reimbursements) since
-- mixing those in would distort the hourly-rate comparison.
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
      coalesce(sum(amount_cents) filter (where status = 'approved'), 0) as approved_full_amount_cents
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
