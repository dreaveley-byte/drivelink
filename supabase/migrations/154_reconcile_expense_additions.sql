-- Root cause of a real billing bug: approving an expense locks in its
-- approved_addition_cents (how much of it gets added to the dealer's bill)
-- against whatever baseline_*_cents was on the job AT THAT MOMENT. Editing
-- a job later recalculates pricing and overwrites baseline_fuel_cents /
-- baseline_hotel_cents / etc, but nothing ever went back and recomputed
-- already-approved expenses against the new numbers - so a job edited
-- after expenses were approved could keep charging the dealer based on a
-- stale (often lower or zero) baseline, even though the current baseline
-- has plenty of headroom.
--
-- This recomputes every approved expense in the baseline categories
-- (fuel/inspection/hotel/ferry) in submission order against the job's
-- CURRENT baseline - same incremental-over-threshold math as
-- computeExpenseAddAmount in src/lib/expenses.ts - food always adds $0,
-- and every other category keeps its full amount (unaffected, since they
-- were never baseline-offset in the first place). Then re-sums
-- approved_expenses_cents on the job to match.
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

  foreach v_cat in array array['fuel', 'inspection', 'hotel', 'ferry'] loop
    v_baseline := case v_cat
      when 'fuel' then coalesce(v_job.baseline_fuel_cents, 0)
      when 'inspection' then coalesce(v_job.baseline_inspection_cents, 0)
      when 'hotel' then coalesce(v_job.baseline_hotel_cents, 0)
      when 'ferry' then coalesce(v_job.baseline_ferry_cents, 0)
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
    and category not in ('fuel', 'inspection', 'hotel', 'ferry', 'food');

  select coalesce(sum(approved_addition_cents), 0) into v_total
  from job_expenses where job_id = p_job_id and status = 'approved';

  update jobs set approved_expenses_cents = v_total where id = p_job_id;
end;
$$;

grant execute on function recompute_job_expense_additions(uuid) to authenticated;

-- One-time backfill: reconcile every job with at least one approved expense
-- so already-affected jobs get corrected too, not only ones edited going
-- forward. Deliberately skips jobs already marked as dealer-paid
-- (dealer_paid_at is not null) - changing the billed total after an
-- invoice has already been settled needs a deliberate decision (credit/
-- adjustment), not a silent rewrite by a migration.
do $$
declare
  v_job_id uuid;
begin
  for v_job_id in
    select distinct e.job_id
    from job_expenses e
    join jobs j on j.id = e.job_id
    where e.status = 'approved' and j.dealer_paid_at is null
  loop
    perform recompute_job_expense_additions(v_job_id);
  end loop;
end $$;
