-- Admin billing/pay corrections.
--
-- Problem this solves: a job's dealer charge (estimated_dealer_cost_cents) and
-- driver pay (estimated_driver_pay_cents / final_driver_pay_cents) could end
-- up missing or $0 - e.g. a recalculation on the edit page that didn't save
-- properly after the drive had already started - with no way for admin to
-- correct it directly, and no way to notice it had happened.
--
-- 1) job_billing_audit: every manual correction is recorded (old and new
--    values, who, when, why).
-- 2) admin_set_job_amounts(): the one supported way for platform admin to set
--    the dealer charge and/or driver pay on a job at ANY status. Admin-only,
--    atomic, and writes the audit row in the same transaction.
-- 3) jobs_needing_billing_attention(): jobs past the point of being claimed
--    that have a missing or $0 dealer charge or driver pay.

create table if not exists job_billing_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  reason text not null,
  old_dealer_cost_cents integer,
  new_dealer_cost_cents integer,
  old_driver_pay_cents integer,
  new_driver_pay_cents integer,
  old_final_driver_pay_cents integer,
  new_final_driver_pay_cents integer,
  cleared_pay_override boolean not null default false
);

create index if not exists job_billing_audit_job_idx on job_billing_audit (job_id, changed_at desc);

alter table job_billing_audit enable row level security;

drop policy if exists "admin reads billing audit" on job_billing_audit;
create policy "admin reads billing audit" on job_billing_audit
  for select using (my_role() = 'platform_admin');

grant select on job_billing_audit to authenticated;

-- Pass null for either amount to leave that side unchanged.
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

  -- An active pay override (set from the hours-override tool) takes priority
  -- over everything else on the receipt, so an explicit driver pay figure
  -- here has to clear it or it would silently be ignored.
  v_clear_override := p_driver_pay_cents is not null and j.admin_pay_override_cents is not null;

  update jobs set
    estimated_dealer_cost_cents = coalesce(p_dealer_cost_cents, estimated_dealer_cost_cents),
    estimated_driver_pay_cents = coalesce(p_driver_pay_cents, estimated_driver_pay_cents),
    final_driver_pay_cents = case
      when p_driver_pay_cents is not null and status = 'completed' then p_driver_pay_cents
      else final_driver_pay_cents
    end,
    admin_pay_override_cents = case when v_clear_override then null else admin_pay_override_cents end,
    admin_hours_override = case when v_clear_override then null else admin_hours_override end
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

-- Jobs that have been claimed (so a driver is on them and money is owed on
-- both sides) but have a missing or $0 dealer charge or driver pay.
create or replace function jobs_needing_billing_attention()
returns table (
  id uuid,
  status text,
  organization_name text,
  driver_name text,
  pickup_address text,
  dropoff_address text,
  estimated_dealer_cost_cents integer,
  effective_driver_pay_cents integer,
  problem text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    j.id,
    j.status::text,
    o.name,
    p.full_name,
    j.pickup_address,
    j.dropoff_address,
    j.estimated_dealer_cost_cents,
    coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents),
    case
      when coalesce(j.estimated_dealer_cost_cents, 0) <= 0
       and coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0) <= 0
        then 'Dealer not billed AND driver not paid'
      when coalesce(j.estimated_dealer_cost_cents, 0) <= 0 then 'Dealer not billed'
      else 'Driver not paid'
    end
  from jobs j
  left join organizations o on o.id = j.organization_id
  left join profiles p on p.id = j.driver_id
  where my_role() = 'platform_admin'
    and j.archived_at is null
    and j.driver_id is not null
    and j.status in ('assigned', 'picked_up', 'in_progress', 'delivered', 'completed')
    and (
      coalesce(j.estimated_dealer_cost_cents, 0) <= 0
      or coalesce(j.admin_pay_override_cents, j.final_driver_pay_cents, j.estimated_driver_pay_cents, 0) <= 0
    )
  order by j.created_at desc;
$$;

grant execute on function jobs_needing_billing_attention() to authenticated;

notify pgrst, 'reload schema';
