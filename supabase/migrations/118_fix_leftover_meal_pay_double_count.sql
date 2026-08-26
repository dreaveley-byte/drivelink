-- Fixes compute_final_driver_pay() / recompute_final_pay_on_expense_change()
-- (introduced in 100_leftover_meal_pay.sql, tweaked in 101_recompute_pay_on_late_expense.sql).
--
-- The old formula was:
--   final_driver_pay_cents = estimated_driver_pay_cents + leftover_food_cents
-- where leftover_food_cents = greatest(0, baseline_food_cents - actual_approved_food_cents).
--
-- estimated_driver_pay_cents already has the FULL flat meal allowance
-- (baseline_food_cents) baked into it from the pricing calculation — it's
-- not just hours/wear-and-tear/overnight. Adding the leftover on top of that
-- (rather than in place of the flat allowance) double-counted the accrued
-- meal money and never actually reimbursed the driver's real food spend —
-- a driver who spent less than the baseline got the full flat allowance
-- PLUS the leftover on top, while a driver who spent MORE than the baseline
-- still only got the flat allowance (no reimbursement for the overage at all).
--
-- Corrected formula:
--   final_driver_pay_cents
--     = (estimated_driver_pay_cents - baseline_food_cents)   -- hours + wear&tear + overnight, meal allowance stripped out
--     + actual_approved_food_cents                            -- driver reimbursed dollar-for-dollar for what they actually spent
--     + (leftover_food_cents * 0.5)                           -- driver's 50% share of any accrual left unspent, as an efficiency bonus
--
-- Drivflo keeps the other 50% of any leftover as extra profit (on top of what
-- it already keeps by never billing the dealer more than the flat accrual for
-- food). If the driver overspends the food baseline, leftover is 0 (no bonus)
-- and Drivflo absorbs the overage — food still never adds to the dealer bill,
-- unchanged from existing policy.

create or replace function compute_final_driver_pay()
returns trigger
language plpgsql
as $$
declare
  v_actual_food_cents int;
  v_leftover_food_cents int;
  v_base_pay_without_meals_cents int;
begin
  if NEW.status = 'completed' and (OLD.status is distinct from 'completed') then
    select coalesce(sum(amount_cents), 0) into v_actual_food_cents
    from job_expenses
    where job_id = NEW.id and category = 'food' and status = 'approved';

    v_leftover_food_cents := greatest(0, coalesce(NEW.baseline_food_cents, 0) - v_actual_food_cents);
    v_base_pay_without_meals_cents := coalesce(NEW.estimated_driver_pay_cents, 0) - coalesce(NEW.baseline_food_cents, 0);

    NEW.final_driver_pay_cents := v_base_pay_without_meals_cents + v_actual_food_cents + round((v_leftover_food_cents * 0.5)::numeric)::int;
  end if;
  return NEW;
end;
$$;

create or replace function recompute_final_pay_on_expense_change()
returns trigger
language plpgsql
as $$
declare
  v_job_id uuid;
  v_job jobs;
  v_actual_food_cents int;
  v_leftover_food_cents int;
  v_base_pay_without_meals_cents int;
begin
  v_job_id := coalesce(NEW.job_id, OLD.job_id);
  select * into v_job from jobs where id = v_job_id;

  if v_job.status = 'completed' then
    select coalesce(sum(amount_cents), 0) into v_actual_food_cents
    from job_expenses
    where job_id = v_job_id and category = 'food' and status = 'approved';

    v_leftover_food_cents := greatest(0, coalesce(v_job.baseline_food_cents, 0) - v_actual_food_cents);
    v_base_pay_without_meals_cents := coalesce(v_job.estimated_driver_pay_cents, 0) - coalesce(v_job.baseline_food_cents, 0);

    update jobs
    set final_driver_pay_cents = v_base_pay_without_meals_cents + v_actual_food_cents + round((v_leftover_food_cents * 0.5)::numeric)::int
    where id = v_job_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- Backfill: recompute final_driver_pay_cents for already-completed jobs so
-- existing records reflect the corrected formula instead of staying wrong
-- until their next status/expense change.
update jobs j
set final_driver_pay_cents =
  (coalesce(j.estimated_driver_pay_cents, 0) - coalesce(j.baseline_food_cents, 0))
  + coalesce((select sum(amount_cents) from job_expenses where job_id = j.id and category = 'food' and status = 'approved'), 0)
  + round((greatest(0, coalesce(j.baseline_food_cents, 0) - coalesce((select sum(amount_cents) from job_expenses where job_id = j.id and category = 'food' and status = 'approved'), 0)) * 0.5)::numeric)::int
where j.status = 'completed';
