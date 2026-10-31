-- 1) Car wash accrual: a flat allowance priced into a normal vehicle delivery.
--    A driver's real car wash receipt is checked against it, and only the
--    amount OVER it is billed to the dealer (same offset system as fuel,
--    inspection, hotel, ferry and return transport).
-- 2) BC insurance transfer: an extra driver hour on BC deliveries.
-- Both are off in the app until this has been run (the app checks for the
-- new settings columns before using either).

alter table pricing_settings add column if not exists car_wash_accrual_cents int not null default 2000;
alter table pricing_settings add column if not exists bc_insurance_transfer_hours numeric not null default 1;

alter table jobs add column if not exists baseline_car_wash_cents int not null default 0;
-- null = never decided (jobs posted before this feature). The edit/post forms
-- turn it on automatically for BC deliveries and save the explicit choice.
alter table jobs add column if not exists bc_insurance_transfer boolean;

alter table job_expenses drop constraint if exists job_expenses_category_check;
alter table job_expenses add constraint job_expenses_category_check
  check (category in ('wait_time', 'repairs', 'tolls', 'parking', 'storage', 'additional_mileage', 'fuel', 'food', 'inspection', 'return_transport', 'hotel', 'charging', 'ferry', 'towing', 'car_wash', 'other'));

-- Replays every approved expense against the job's baselines (adds car_wash to
-- the categories that only bill the amount over the baseline). Everything
-- else is unchanged from migration 162.
create or replace function recompute_job_expense_additions(p_job_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_job jobs%rowtype;
  v_cat text;
  v_baseline int;
  v_prior int;
  v_addition int;
  r record;
  v_total int;
begin
  select * into v_job from jobs where id = p_job_id;
  if v_job is null then
    return;
  end if;

  foreach v_cat in array array['fuel', 'inspection', 'hotel', 'ferry', 'return_transport', 'car_wash'] loop
    v_baseline := case v_cat
      when 'fuel' then coalesce(v_job.baseline_fuel_cents, 0)
      when 'inspection' then coalesce(v_job.baseline_inspection_cents, 0)
      when 'hotel' then coalesce(v_job.baseline_hotel_cents, 0)
      when 'ferry' then coalesce(v_job.baseline_ferry_cents, 0)
      when 'return_transport' then coalesce(v_job.baseline_return_transport_cents, 0)
      when 'car_wash' then coalesce(v_job.baseline_car_wash_cents, 0)
    end;
    v_prior := 0;
    for r in
      select id, amount_cents from job_expenses
      where job_id = p_job_id and category = v_cat and status = 'approved'
      order by created_at asc
    loop
      v_addition := greatest(0, v_prior + r.amount_cents - v_baseline) - greatest(0, v_prior - v_baseline);
      update job_expenses set approved_addition_cents = v_addition where id = r.id;
      v_prior := v_prior + r.amount_cents;
    end loop;
  end loop;

  update job_expenses set approved_addition_cents = 0
  where job_id = p_job_id and category = 'food' and status = 'approved';

  update job_expenses set approved_addition_cents = amount_cents
  where job_id = p_job_id and status = 'approved'
    and category not in ('fuel', 'inspection', 'hotel', 'ferry', 'return_transport', 'car_wash', 'food');

  select coalesce(sum(approved_addition_cents), 0) into v_total
  from job_expenses where job_id = p_job_id and status = 'approved';

  update jobs set approved_expenses_cents = v_total where id = p_job_id;
end;
$$;

-- Admin "Accrued vs. actual" table: adds the car wash row.
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
  from jobs j where j.id = p_job_id
  union all
  select 'return_transport', j.baseline_return_transport_cents, coalesce((select sum(amount_cents) from job_expenses where job_id = p_job_id and category = 'return_transport' and status = 'approved'), 0)::int
  from jobs j where j.id = p_job_id
  union all
  select 'car_wash', j.baseline_car_wash_cents, coalesce((select sum(amount_cents) from job_expenses where job_id = p_job_id and category = 'car_wash' and status = 'approved'), 0)::int
  from jobs j where j.id = p_job_id;
$$;

grant execute on function get_job_expense_comparison(uuid) to authenticated;

-- Admin "restore baselines" tool: adds an optional car wash amount (null =
-- leave unchanged). Replaces the 8-argument version from migration 178 so
-- calls without p_car_wash keep working and there's no ambiguous overload.
drop function if exists admin_set_job_baselines(uuid, integer, integer, integer, integer, integer, integer, text);

create or replace function admin_set_job_baselines(
  p_job_id uuid,
  p_fuel integer,
  p_inspection integer,
  p_food integer,
  p_hotel integer,
  p_ferry integer,
  p_return_transport integer,
  p_reason text,
  p_car_wash integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j jobs%rowtype;
  v_changes text;
begin
  if my_role() is distinct from 'platform_admin' then
    raise exception 'Only platform admin can change accrued baselines.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required.';
  end if;
  if coalesce(p_fuel, 0) < 0 or coalesce(p_inspection, 0) < 0 or coalesce(p_food, 0) < 0
     or coalesce(p_hotel, 0) < 0 or coalesce(p_ferry, 0) < 0 or coalesce(p_return_transport, 0) < 0
     or coalesce(p_car_wash, 0) < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;
  if p_fuel is null and p_inspection is null and p_food is null
     and p_hotel is null and p_ferry is null and p_return_transport is null and p_car_wash is null then
    raise exception 'Nothing to change.';
  end if;

  select * into j from jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found.';
  end if;

  v_changes := array_to_string(array_remove(array[
    case when p_fuel is not null and p_fuel is distinct from j.baseline_fuel_cents
      then 'fuel $' || (coalesce(j.baseline_fuel_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_fuel / 100.0)::numeric(10,2) end,
    case when p_inspection is not null and p_inspection is distinct from j.baseline_inspection_cents
      then 'inspection $' || (coalesce(j.baseline_inspection_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_inspection / 100.0)::numeric(10,2) end,
    case when p_food is not null and p_food is distinct from j.baseline_food_cents
      then 'food $' || (coalesce(j.baseline_food_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_food / 100.0)::numeric(10,2) end,
    case when p_hotel is not null and p_hotel is distinct from j.baseline_hotel_cents
      then 'hotel $' || (coalesce(j.baseline_hotel_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_hotel / 100.0)::numeric(10,2) end,
    case when p_ferry is not null and p_ferry is distinct from j.baseline_ferry_cents
      then 'ferry $' || (coalesce(j.baseline_ferry_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_ferry / 100.0)::numeric(10,2) end,
    case when p_return_transport is not null and p_return_transport is distinct from j.baseline_return_transport_cents
      then 'return transport $' || (coalesce(j.baseline_return_transport_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_return_transport / 100.0)::numeric(10,2) end,
    case when p_car_wash is not null and p_car_wash is distinct from j.baseline_car_wash_cents
      then 'car wash $' || (coalesce(j.baseline_car_wash_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_car_wash / 100.0)::numeric(10,2) end
  ], null), ', ');

  update jobs set
    baseline_fuel_cents = coalesce(p_fuel, baseline_fuel_cents),
    baseline_inspection_cents = coalesce(p_inspection, baseline_inspection_cents),
    baseline_food_cents = coalesce(p_food, baseline_food_cents),
    baseline_hotel_cents = coalesce(p_hotel, baseline_hotel_cents),
    baseline_ferry_cents = coalesce(p_ferry, baseline_ferry_cents),
    baseline_return_transport_cents = coalesce(p_return_transport, baseline_return_transport_cents),
    baseline_car_wash_cents = coalesce(p_car_wash, baseline_car_wash_cents)
  where id = p_job_id;

  perform recompute_job_expense_additions(p_job_id);

  insert into job_billing_audit (job_id, changed_by, reason)
  values (
    p_job_id,
    auth.uid(),
    'Accrued baselines restored' || case when v_changes <> '' then ' (' || v_changes || ')' else ' (no values changed)' end
      || ': ' || trim(p_reason)
  );
end;
$$;

grant execute on function admin_set_job_baselines(uuid, integer, integer, integer, integer, integer, integer, text, integer) to authenticated;

notify pgrst, 'reload schema';
