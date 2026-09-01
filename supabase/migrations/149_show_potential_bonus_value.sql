-- Always store the POTENTIAL bonus value (what it would have been) even
-- when not eligible, so admin can see it and use it as a starting point
-- to override with, rather than only ever seeing $0 when ineligible.
-- performance_bonus_eligible remains the separate flag that determines
-- whether this actually gets paid out automatically - every place that
-- treats the bonus as a real cost/payout needs to check eligibility (or
-- an explicit override) before using this value, not just read it directly.
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
    -- Always the potential amount now, regardless of eligibility -
    -- callers that pay it out must check performance_bonus_eligible (or
    -- an override) separately before using this value.
    performance_bonus_cents = round((v_leftover_food_cents * 0.5)::numeric)::int
  where id = p_job_id;
end;
$$;

-- Re-run for every already-completed job so existing records show the
-- potential value immediately instead of $0 for anything ineligible.
do $$
declare
  v_job_id uuid;
begin
  for v_job_id in select id from jobs where status = 'completed' loop
    perform compute_performance_bonus(v_job_id);
  end loop;
end $$;
