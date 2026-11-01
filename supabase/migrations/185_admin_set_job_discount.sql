-- Receipt-page discount: admin sets a % off the dealer charge for one job.
-- The pre-discount amount is worked back from the stored discount, so changing
-- 10% to 15% discounts the ORIGINAL price (it doesn't stack). Needs migration 184.

create or replace function admin_set_job_discount(
  p_job_id uuid,
  p_percent numeric,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j jobs%rowtype;
  v_base integer;
  v_new integer;
begin
  if my_role() is distinct from 'platform_admin' then
    raise exception 'Only platform admin can discount a job.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required.';
  end if;
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'Discount must be between 0 and 100 percent.';
  end if;

  select * into j from jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found.';
  end if;
  if coalesce(j.estimated_dealer_cost_cents, 0) <= 0 then
    raise exception 'This job has no dealer charge to discount yet.';
  end if;

  v_base := case
    when coalesce(j.admin_discount_percent, 0) > 0 and j.admin_discount_percent < 100
      then round(j.estimated_dealer_cost_cents / (1 - j.admin_discount_percent / 100.0))
    else j.estimated_dealer_cost_cents
  end;
  v_new := round(v_base * (1 - p_percent / 100.0));

  update jobs set
    estimated_dealer_cost_cents = v_new,
    admin_discount_percent = p_percent
  where id = p_job_id;

  insert into job_billing_audit (job_id, changed_by, reason, old_dealer_cost_cents, new_dealer_cost_cents)
  values (p_job_id, auth.uid(), 'Discount ' || p_percent || '%: ' || trim(p_reason), j.estimated_dealer_cost_cents, v_new);
end;
$$;

grant execute on function admin_set_job_discount(uuid, numeric, text) to authenticated;

-- Setting the dealer charge by hand replaces the discounted figure, so the
-- recorded discount no longer applies - clear it so a later discount starts clean.
create or replace function admin_set_job_amounts(
  p_job_id uuid,
  p_dealer_cost_cents integer,
  p_driver_pay_cents integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j jobs%rowtype;
  v_clear_override boolean := false;
begin
  if my_role() is distinct from 'platform_admin' then
    raise exception 'Only platform admin can correct job amounts.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required.';
  end if;
  if p_dealer_cost_cents is null and p_driver_pay_cents is null then
    raise exception 'Nothing to change.';
  end if;
  if coalesce(p_dealer_cost_cents, 0) < 0 or coalesce(p_driver_pay_cents, 0) < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;

  select * into j from jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found.';
  end if;

  v_clear_override := p_driver_pay_cents is not null and j.admin_pay_override_cents is not null;

  update jobs set
    estimated_dealer_cost_cents = coalesce(p_dealer_cost_cents, estimated_dealer_cost_cents),
    estimated_driver_pay_cents = coalesce(p_driver_pay_cents, estimated_driver_pay_cents),
    final_driver_pay_cents = case
      when p_driver_pay_cents is not null and status = 'completed' then p_driver_pay_cents
      else final_driver_pay_cents
    end,
    admin_pay_override_cents = case when v_clear_override then null else admin_pay_override_cents end,
    admin_hours_override = case when v_clear_override then null else admin_hours_override end,
    admin_discount_percent = case when p_dealer_cost_cents is not null then 0 else admin_discount_percent end
  where id = p_job_id;

  insert into job_billing_audit (
    job_id, changed_by, reason,
    old_dealer_cost_cents, new_dealer_cost_cents,
    old_driver_pay_cents, new_driver_pay_cents,
    old_final_driver_pay_cents, new_final_driver_pay_cents,
    cleared_pay_override
  ) values (
    p_job_id, auth.uid(), trim(p_reason),
    j.estimated_dealer_cost_cents, coalesce(p_dealer_cost_cents, j.estimated_dealer_cost_cents),
    j.estimated_driver_pay_cents, coalesce(p_driver_pay_cents, j.estimated_driver_pay_cents),
    j.final_driver_pay_cents,
    case when p_driver_pay_cents is not null and j.status = 'completed' then p_driver_pay_cents else j.final_driver_pay_cents end,
    v_clear_override
  );
end;
$$;
grant execute on function admin_set_job_amounts(uuid, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
