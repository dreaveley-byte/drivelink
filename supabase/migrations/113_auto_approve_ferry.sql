create or replace function auto_approve_expense()
returns trigger
language plpgsql
as $$
declare
  v_job jobs;
  v_baseline int;
  v_prior_approved_same_category int;
  v_add_amount int;
  v_date_ok boolean;
begin
  select * into v_job from jobs where id = NEW.job_id;
  if v_job is null then
    return NEW;
  end if;

  v_date_ok := NEW.receipt_date is not null
    and v_job.scheduled_for is not null
    and NEW.receipt_date between (v_job.scheduled_for::date - 2) and (v_job.scheduled_for::date + 5);

  if not v_date_ok or not NEW.looks_legitimate then
    return NEW;
  end if;

  if NEW.category = 'food' then
    v_add_amount := 0;
  elsif NEW.category in ('fuel', 'inspection', 'hotel', 'ferry') then
    v_baseline := case NEW.category
      when 'fuel' then v_job.baseline_fuel_cents
      when 'inspection' then v_job.baseline_inspection_cents
      when 'hotel' then v_job.baseline_hotel_cents
      when 'ferry' then v_job.baseline_ferry_cents
    end;
    select coalesce(sum(amount_cents), 0) into v_prior_approved_same_category
    from job_expenses where job_id = NEW.job_id and category = NEW.category and status = 'approved';
    v_add_amount := greatest(0, v_prior_approved_same_category + NEW.amount_cents - v_baseline)
                  - greatest(0, v_prior_approved_same_category - v_baseline);
  else
    return NEW;
  end if;

  if v_add_amount = 0 then
    NEW.status := 'approved';
    NEW.approved_addition_cents := 0;
    NEW.reviewed_at := now();
    NEW.auto_approved := true;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_approve_expense on job_expenses;
create trigger trg_auto_approve_expense
before insert on job_expenses
for each row
execute function auto_approve_expense();
