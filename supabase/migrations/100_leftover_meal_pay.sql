create or replace function compute_final_driver_pay()
returns trigger
language plpgsql
as $$
declare
  v_actual_food_cents int;
  v_leftover_food_cents int;
begin
  if NEW.status = 'completed' and (OLD.status is distinct from 'completed') then
    select coalesce(sum(amount_cents), 0) into v_actual_food_cents
    from job_expenses
    where job_id = NEW.id and category = 'food' and status = 'approved';

    v_leftover_food_cents := greatest(0, NEW.baseline_food_cents - v_actual_food_cents);

    NEW.final_driver_pay_cents := coalesce(NEW.estimated_driver_pay_cents, 0) + v_leftover_food_cents;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_compute_final_driver_pay on jobs;
create trigger trg_compute_final_driver_pay
before update on jobs
for each row
execute function compute_final_driver_pay();

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
  from jobs j where j.id = p_job_id;
$$;

grant execute on function get_job_expense_comparison(uuid) to authenticated;
