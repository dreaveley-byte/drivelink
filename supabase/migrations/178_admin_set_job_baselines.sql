-- Admin tool to restore a job's accrued baselines (fuel / inspection / food /
-- hotel / ferry / return transport).
--
-- Why: a job edit that saved while pricing was empty used to write every
-- baseline_*_cents as 0 (fixed in the app separately). With all baselines at
-- 0, every approved receipt counted as a brand-new extra and was added to the
-- dealer's bill in full - even for costs already priced into the quote - and
-- the admin "Accrued vs. actual" view showed $0 accrued for everything.
--
-- This sets the baselines (pass null to leave one unchanged), then
-- immediately replays every approved expense against them with the existing
-- recompute_job_expense_additions(), so the dealer's billed total is
-- corrected in the same step. Admin-only, and recorded in job_billing_audit.
create or replace function admin_set_job_baselines(
  p_job_id uuid,
  p_fuel integer,
  p_inspection integer,
  p_food integer,
  p_hotel integer,
  p_ferry integer,
  p_return_transport integer,
  p_reason text
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
     or coalesce(p_hotel, 0) < 0 or coalesce(p_ferry, 0) < 0 or coalesce(p_return_transport, 0) < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;
  if p_fuel is null and p_inspection is null and p_food is null
     and p_hotel is null and p_ferry is null and p_return_transport is null then
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
      then 'return transport $' || (coalesce(j.baseline_return_transport_cents, 0) / 100.0)::numeric(10,2) || ' -> $' || (p_return_transport / 100.0)::numeric(10,2) end
  ], null), ', ');

  update jobs set
    baseline_fuel_cents = coalesce(p_fuel, baseline_fuel_cents),
    baseline_inspection_cents = coalesce(p_inspection, baseline_inspection_cents),
    baseline_food_cents = coalesce(p_food, baseline_food_cents),
    baseline_hotel_cents = coalesce(p_hotel, baseline_hotel_cents),
    baseline_ferry_cents = coalesce(p_ferry, baseline_ferry_cents),
    baseline_return_transport_cents = coalesce(p_return_transport, baseline_return_transport_cents)
  where id = p_job_id;

  -- Re-bill every approved receipt against the corrected baselines and
  -- re-total approved_expenses_cents on the job.
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

grant execute on function admin_set_job_baselines(uuid, integer, integer, integer, integer, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
