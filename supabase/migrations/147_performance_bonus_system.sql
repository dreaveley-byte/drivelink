-- Redesigns the meal-leftover handling per Dan's correction:
-- 1. Food expenses go back to being a normal expense, reimbursed through
--    the regular expense-approval system like any other receipt - no
--    longer excluded from that sum or folded into driver pay.
-- 2. The unused meal-budget leftover becomes a distinct "Performance
--    bonus" - shown separately from pay entirely, not blended into it.
-- 3. The bonus is conditional: only awarded if every checklist item was
--    completed AND the customer left a 5-star rating. Admin can override
--    it in either direction for edge cases.

alter table jobs add column if not exists performance_bonus_cents int;
alter table jobs add column if not exists performance_bonus_override_cents int;
alter table jobs add column if not exists performance_bonus_eligible boolean;

-- final_driver_pay_cents now strips the meal accrual out entirely and
-- nothing else - no more folding actual/leftover food into pay. Food
-- itself flows through the normal expense system; the leftover flows
-- through the new bonus system below.
create or replace function compute_final_driver_pay()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'completed' and (OLD.status is distinct from 'completed') then
    NEW.final_driver_pay_cents := coalesce(NEW.estimated_driver_pay_cents, 0) - coalesce(NEW.baseline_food_cents, 0);
  end if;
  return NEW;
end;
$$;

-- Old per-expense-change recompute trigger is no longer needed now that
-- final_driver_pay_cents doesn't depend on food expenses at all - drop it
-- so an approved/unapproved food receipt doesn't try to recompute pay
-- using a function that no longer exists in that shape.
drop trigger if exists trg_recompute_final_pay_on_expense_change on job_expenses;
drop function if exists recompute_final_pay_on_expense_change();

-- Standalone function (not a simple row trigger) since it needs to check
-- job_checklist_items, a separate table - called both when a job
-- completes and whenever a customer rating arrives afterward, since
-- ratings are submitted asynchronously via the public tracking link and
-- may not exist yet at completion time.
create or replace function compute_performance_bonus(p_job_id uuid)
returns void
language plpgsql
as $$
declare
  v_job jobs;
  v_actual_food_cents int;
  v_leftover_food_cents int;
  v_all_checklist_complete boolean;
begin
  select * into v_job from jobs where id = p_job_id;
  if v_job is null or v_job.status <> 'completed' then
    return;
  end if;

  -- Never overwrite an admin override - the bonus stays whatever they set
  -- until they explicitly remove it, regardless of how eligibility or
  -- inputs change afterward.
  if v_job.performance_bonus_override_cents is not null then
    return;
  end if;

  select coalesce(sum(amount_cents), 0) into v_actual_food_cents
  from job_expenses
  where job_id = p_job_id and category = 'food' and status = 'approved';
  v_leftover_food_cents := greatest(0, coalesce(v_job.baseline_food_cents, 0) - v_actual_food_cents);

  select not exists (
    select 1 from job_checklist_items where job_id = p_job_id and completed_at is null
  ) and exists (
    select 1 from job_checklist_items where job_id = p_job_id
  ) into v_all_checklist_complete;

  update jobs
  set
    performance_bonus_eligible = v_all_checklist_complete and v_job.customer_rating = 5,
    performance_bonus_cents = case
      when v_all_checklist_complete and v_job.customer_rating = 5 then round((v_leftover_food_cents * 0.5)::numeric)::int
      else 0
    end
  where id = p_job_id;
end;
$$;

create or replace function trigger_compute_performance_bonus_on_completion()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'completed' and (OLD.status is distinct from 'completed') then
    perform compute_performance_bonus(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists compute_performance_bonus_on_completion on jobs;
create trigger compute_performance_bonus_on_completion
after update on jobs
for each row
execute function trigger_compute_performance_bonus_on_completion();

create or replace function trigger_recompute_bonus_on_rating()
returns trigger
language plpgsql
as $$
begin
  if NEW.customer_rating is distinct from OLD.customer_rating then
    perform compute_performance_bonus(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists recompute_bonus_on_rating on jobs;
create trigger recompute_bonus_on_rating
after update on jobs
for each row
execute function trigger_recompute_bonus_on_rating();

-- Backfill: recompute for every already-completed job using the real
-- checklist/rating data now on record, so existing jobs reflect the new
-- system immediately.
do $$
declare
  v_job_id uuid;
begin
  for v_job_id in select id from jobs where status = 'completed' loop
    perform compute_performance_bonus(v_job_id);
  end loop;
end $$;

-- Also re-run the corrected final_driver_pay_cents formula (meals fully
-- stripped, no leftover folded in) for every already-completed job.
update jobs
set final_driver_pay_cents = coalesce(estimated_driver_pay_cents, 0) - coalesce(baseline_food_cents, 0)
where status = 'completed';
