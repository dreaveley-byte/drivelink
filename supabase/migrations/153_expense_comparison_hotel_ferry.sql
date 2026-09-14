-- get_job_expense_comparison only ever compared fuel/inspection/food,
-- because that's all that existed when it was written (migration 100).
-- Hotel and ferry baselines were added to the billing-offset logic later
-- (computeExpenseAddAmount in src/lib/expenses.ts already handles both
-- correctly) but this admin-facing comparison view was never updated to
-- match, so a job that went over its hotel or ferry baseline looked
-- unexplained here even though it was billed correctly.
create or replace function get_job_expense_comparison(p_job_id uuid)
returns table (
  category text,
  accrued_cents int,
  actual_cents int
)
language sql
security definer
stable
as $$
  select 'fuel', j.baseline_fuel_cents, coalesce((select sum(amount_cents) from job_expenses where job_id = p_job_id and category = 'fuel' and status = 'approved'), 0)::int
  from jobs j where j.id = p_job_id
  union all
  select 'inspection', j.baseline_inspection_cents, coalesce((select sum(amount_cents) from job_expenses where job_id = p_job_id and category = 'inspection' and status = 'approved'), 0)::int
  from jobs j where j.id = p_job_id
  union all
  select 'food', j.baseline_food_cents, coalesce((select sum(amount_cents) from job_expenses where job_id = p_job_id and category = 'food' and status = 'approved'), 0)::int
  from jobs j where j.id = p_job_id
  union all
  select 'hotel', j.baseline_hotel_cents, coalesce((select sum(amount_cents) from job_expenses where job_id = p_job_id and category = 'hotel' and status = 'approved'), 0)::int
  from jobs j where j.id = p_job_id
  union all
  select 'ferry', j.baseline_ferry_cents, coalesce((select sum(amount_cents) from job_expenses where job_id = p_job_id and category = 'ferry' and status = 'approved'), 0)::int
  from jobs j where j.id = p_job_id;
$$;

grant execute on function get_job_expense_comparison(uuid) to authenticated;
