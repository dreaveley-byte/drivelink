create or replace function recompute_final_pay_on_expense_change()
returns trigger
language plpgsql
as $$
declare
  v_job_id uuid;
  v_job jobs;
  v_actual_food_cents int;
  v_leftover_food_cents int;
begin
  v_job_id := coalesce(NEW.job_id, OLD.job_id);
  select * into v_job from jobs where id = v_job_id;

  if v_job.status = 'completed' then
    select coalesce(sum(amount_cents), 0) into v_actual_food_cents
    from job_expenses
    where job_id = v_job_id and category = 'food' and status = 'approved';

    v_leftover_food_cents := greatest(0, v_job.baseline_food_cents - v_actual_food_cents);

    update jobs
    set final_driver_pay_cents = coalesce(v_job.estimated_driver_pay_cents, 0) + v_leftover_food_cents
    where id = v_job_id;
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_recompute_final_pay_on_expense_change on job_expenses;
create trigger trg_recompute_final_pay_on_expense_change
after insert or update or delete on job_expenses
for each row
execute function recompute_final_pay_on_expense_change();
