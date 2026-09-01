-- Re-applies the correct formula regardless of what's currently deployed -
-- confirmed via a real job (Antonio, stock #L25338A) that the live
-- final_driver_pay_cents ($635.41) doesn't match what this formula should
-- produce given the real data ($559.94) - the $75.47 gap is exactly the
-- FULL unused meal leftover ($80.00 baseline - $4.53 actual spent),
-- suggesting the deployed version is giving drivers the entire leftover
-- rather than the intended 50% efficiency bonus.
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

-- Recompute final_driver_pay_cents for every already-completed job using
-- the correct formula, so existing records get fixed immediately rather
-- than only correcting going forward.
update jobs j
set final_driver_pay_cents =
  (coalesce(j.estimated_driver_pay_cents, 0) - coalesce(j.baseline_food_cents, 0))
  + coalesce((select sum(amount_cents) from job_expenses where job_id = j.id and category = 'food' and status = 'approved'), 0)
  + round((greatest(0, coalesce(j.baseline_food_cents, 0) - coalesce((select sum(amount_cents) from job_expenses where job_id = j.id and category = 'food' and status = 'approved'), 0)) * 0.5)::numeric)::int
where j.status = 'completed';
