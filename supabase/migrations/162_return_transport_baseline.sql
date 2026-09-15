-- Real billing bug, same class as the fuel/hotel one fixed earlier, but for
-- a category that was never covered by the baseline-offset system at all:
-- when the driver's return method is "Uber back", the dealer''s original
-- price already includes an estimated ground-transport cost for that ride
-- home (folded into the generic "Other extras" line, with no dedicated
-- field of its own). When the driver later submits their actual Uber/bus/
-- taxi receipt (category 'return_transport'), the system had no baseline
-- to check it against, so the full receipt amount got billed to the
-- dealer a second time on top of the estimate already baked into the
-- price - the same ride, billed twice.
alter table jobs add column if not exists baseline_return_transport_cents int not null default 0;

-- Updated to also replay 'return_transport' expenses against its new
-- baseline, alongside fuel/inspection/hotel/ferry - same incremental-
-- over-threshold math, matching src/lib/expenses.ts.
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

  foreach v_cat in array array['fuel', 'inspection', 'hotel', 'ferry', 'return_transport'] loop
    v_baseline := case v_cat
      when 'fuel' then coalesce(v_job.baseline_fuel_cents, 0)
      when 'inspection' then coalesce(v_job.baseline_inspection_cents, 0)
      when 'hotel' then coalesce(v_job.baseline_hotel_cents, 0)
      when 'ferry' then coalesce(v_job.baseline_ferry_cents, 0)
      when 'return_transport' then coalesce(v_job.baseline_return_transport_cents, 0)
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
    and category not in ('fuel', 'inspection', 'hotel', 'ferry', 'return_transport', 'food');

  select coalesce(sum(approved_addition_cents), 0) into v_total
  from job_expenses where job_id = p_job_id and status = 'approved';

  update jobs set approved_expenses_cents = v_total where id = p_job_id;
end;
$$;

-- Adds return_transport to the admin-facing accrued-vs-actual comparison,
-- same as hotel/ferry were added previously.
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
  from jobs j where j.id = p_job_id;
$$;

grant execute on function get_job_expense_comparison(uuid) to authenticated;

-- NOTE: this only fixes jobs going forward, from whenever the app code
-- deploy that starts saving baseline_return_transport_cents at posting
-- time goes live. Already-posted jobs have no record of what their
-- ground-transport estimate actually was (it was never tracked
-- separately before now, only folded into the generic extras total), so
-- there's nothing to correctly backfill here automatically - a specific
-- already-affected job can be corrected manually once its true estimate
-- is known, using something like:
--   update jobs set baseline_return_transport_cents = <amount> where id = '<job id>';
--   select recompute_job_expense_additions('<job id>');
