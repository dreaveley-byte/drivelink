-- Final bill review + profit-share credits (Nov 2026)
--
-- 1. A completed drive's final bill is held until an admin approves it. The
--    dealer still sees the drive, but not any overage/underage/idle charges
--    until approval.
-- 2. At approval, every accrued category is netted (baseline minus actual
--    approved spend). A net overage is billed to the dealer; a net underage
--    (after the driver's performance bonus is taken out of the food leftover)
--    earns the dealer a credit of X% (admin-adjustable) that comes off their
--    next drive and expires after N days (admin-adjustable).
-- 3. The driver's bonus share of unused meal budget becomes adjustable.
--
-- Drives completed BEFORE this migration keep the old rules and are marked
-- approved (legacy) so nothing already billed changes or disappears.

-- ============================================================
-- Settings
-- ============================================================
alter table pricing_settings add column if not exists dealer_credit_share_percent numeric not null default 50;
alter table pricing_settings add column if not exists dealer_credit_expiry_days int not null default 90;
alter table pricing_settings add column if not exists driver_bonus_share_percent numeric not null default 50;

-- ============================================================
-- Job columns
-- ============================================================
alter table jobs add column if not exists final_bill_approved_at timestamptz;
alter table jobs add column if not exists final_bill_approved_by uuid references profiles(id);
alter table jobs add column if not exists final_bill_legacy boolean not null default false;
alter table jobs add column if not exists final_bill_pool_cents int;
alter table jobs add column if not exists final_bill_credit_issued_cents int not null default 0;
alter table jobs add column if not exists final_bill_credit_applied_cents int not null default 0;

-- Anything already completed keeps the old rules and counts as approved.
update jobs
set final_bill_legacy = true,
    final_bill_approved_at = coalesce(completed_at, now())
where status = 'completed' and final_bill_approved_at is null;

-- A drive that (re)completes goes back to "awaiting review" (new-rules drives only).
create or replace function reset_final_bill_on_completion()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' and not NEW.final_bill_legacy then
    NEW.final_bill_approved_at := null;
    NEW.final_bill_approved_by := null;
  end if;
  return NEW;
end;
$$;
drop trigger if exists reset_final_bill_on_completion_trg on jobs;
create trigger reset_final_bill_on_completion_trg before update on jobs
  for each row execute function reset_final_bill_on_completion();

-- ============================================================
-- Credits
-- ============================================================
create table if not exists dealer_credits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_job_id uuid not null references jobs(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  remaining_cents int not null check (remaining_cents >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (source_job_id)
);
create index if not exists dealer_credits_org_idx on dealer_credits(organization_id, expires_at);

create table if not exists dealer_credit_applications (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references dealer_credits(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);
create index if not exists dealer_credit_applications_job_idx on dealer_credit_applications(job_id);

alter table dealer_credits enable row level security;
alter table dealer_credit_applications enable row level security;
drop policy if exists "dealer credits readable by org and admin" on dealer_credits;
create policy "dealer credits readable by org and admin" on dealer_credits
  for select using (organization_id = my_org_id() or my_role() = 'platform_admin');
drop policy if exists "credit applications readable by admin" on dealer_credit_applications;
create policy "credit applications readable by admin" on dealer_credit_applications
  for select using (my_role() = 'platform_admin');
grant select on dealer_credits, dealer_credit_applications to authenticated;

-- ============================================================
-- The one place the final-bill math lives.
--   net_six_cents        baseline - actual, summed over fuel, inspection, hotel,
--                        ferry, return transport and car wash (overages and
--                        underages cancel out)
--   food_pool_cents      unused meal budget left AFTER the driver's performance
--                        bonus is paid out of it (meal overages are not billed,
--                        same as before)
--   pool_cents           net_six + food_pool; positive = Drivflo profit pool
--   other_additions      repairs, tolls, parking etc. - still billed in full
--   dealer_overage       what the dealer is billed on top of the estimate
--   credit_issued        share% of a positive pool, earned as dealer credit
-- ============================================================
create or replace function compute_final_bill(p_job_id uuid)
returns table (
  net_six_cents int,
  food_pool_cents int,
  pool_cents int,
  other_additions_cents int,
  dealer_overage_cents int,
  credit_issued_cents int
)
language plpgsql
security definer
stable
as $$
declare
  j jobs%rowtype;
  s pricing_settings%rowtype;
  v_cat text;
  v_base int;
  v_act int;
  v_net int := 0;
  v_food_left int;
  v_bonus_paid int;
  v_food_pool int;
  v_pool int;
  v_other int;
begin
  select * into j from jobs where id = p_job_id;
  select * into s from pricing_settings where id = 1;
  if j is null then return; end if;

  foreach v_cat in array array['fuel', 'inspection', 'hotel', 'ferry', 'return_transport', 'car_wash'] loop
    v_base := case v_cat
      when 'fuel' then coalesce(j.baseline_fuel_cents, 0)
      when 'inspection' then coalesce(j.baseline_inspection_cents, 0)
      when 'hotel' then coalesce(j.baseline_hotel_cents, 0)
      when 'ferry' then coalesce(j.baseline_ferry_cents, 0)
      when 'return_transport' then coalesce(j.baseline_return_transport_cents, 0)
      when 'car_wash' then coalesce(j.baseline_car_wash_cents, 0)
    end;
    select coalesce(sum(amount_cents), 0) into v_act
    from job_expenses where job_id = p_job_id and category = v_cat and status = 'approved';
    v_net := v_net + v_base - v_act;
  end loop;

  select coalesce(sum(amount_cents), 0) into v_act
  from job_expenses where job_id = p_job_id and category = 'food' and status = 'approved';
  v_food_left := greatest(0, coalesce(j.baseline_food_cents, 0) - v_act);
  v_bonus_paid := case
    when j.performance_bonus_override_cents is not null then j.performance_bonus_override_cents
    when j.performance_bonus_eligible then coalesce(j.performance_bonus_cents, 0)
    else 0
  end;
  v_food_pool := greatest(0, v_food_left - v_bonus_paid);

  v_pool := v_net + v_food_pool;

  select coalesce(sum(amount_cents), 0) into v_other
  from job_expenses
  where job_id = p_job_id and status = 'approved'
    and category not in ('fuel', 'inspection', 'hotel', 'ferry', 'return_transport', 'car_wash', 'food');

  return query select
    v_net,
    v_food_pool,
    v_pool,
    v_other,
    v_other + greatest(0, -v_pool),
    case when v_pool > 0 then round(v_pool * s.dealer_credit_share_percent / 100.0)::int else 0 end;
end;
$$;
revoke all on function compute_final_bill(uuid) from public, anon, authenticated;

-- Admin-facing preview (also reports credits that would be applied).
create or replace function admin_final_bill_preview(p_job_id uuid)
returns table (
  net_six_cents int,
  food_pool_cents int,
  pool_cents int,
  other_additions_cents int,
  dealer_overage_cents int,
  credit_issued_cents int,
  credit_available_cents int
)
language plpgsql
security definer
stable
as $$
declare
  j jobs%rowtype;
begin
  if my_role() is distinct from 'platform_admin' then
    raise exception 'Only platform admin can review final bills.';
  end if;
  select * into j from jobs where id = p_job_id;
  return query
    select b.net_six_cents, b.food_pool_cents, b.pool_cents, b.other_additions_cents, b.dealer_overage_cents, b.credit_issued_cents,
      coalesce((
        select sum(c.remaining_cents
          + coalesce((select sum(a.amount_cents) from dealer_credit_applications a where a.credit_id = c.id and a.job_id = p_job_id), 0))::int
        from dealer_credits c
        where c.organization_id = j.organization_id
          and c.source_job_id <> p_job_id
          and c.created_at <= j.created_at
          and c.expires_at > j.created_at
      ), 0)
    from compute_final_bill(p_job_id) b;
end;
$$;
grant execute on function admin_final_bill_preview(uuid) to authenticated;

-- ============================================================
-- Dealer billed additions: net rule for new-rules completed drives.
-- (Everything else is unchanged from migration 183.)
-- ============================================================
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

  -- New rules: once the drive is completed, overages and underages across all
  -- accrued categories net against each other.
  if v_job.status = 'completed' and not v_job.final_bill_legacy then
    select b.dealer_overage_cents into v_total from compute_final_bill(p_job_id) b;
  end if;

  update jobs set approved_expenses_cents = v_total where id = p_job_id;
end;
$$;

-- ============================================================
-- Approve the final bill. Safe to run again after an edit: it releases the
-- credits it applied last time and re-works everything. It refuses if the
-- credit this drive earned has already been used on another drive.
-- ============================================================
create or replace function approve_final_bill(p_job_id uuid)
returns jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  j jobs%rowtype;
  b record;
  s pricing_settings%rowtype;
  v_total int;
  v_left int;
  v_apply int;
  v_issued int := 0;
  v_applied int := 0;
  v_pool int;
  c record;
  v_credit dealer_credits%rowtype;
begin
  if my_role() is distinct from 'platform_admin' then
    raise exception 'Only platform admin can approve final bills.';
  end if;

  select * into j from jobs where id = p_job_id for update;
  if j is null then raise exception 'Job not found.'; end if;
  if j.status <> 'completed' then raise exception 'Only completed drives can be approved.'; end if;
  select * into s from pricing_settings where id = 1;

  -- Release credits applied the last time this was approved.
  update dealer_credits dc
  set remaining_cents = dc.remaining_cents + a.amount_cents
  from dealer_credit_applications a
  where a.credit_id = dc.id and a.job_id = p_job_id;
  delete from dealer_credit_applications where job_id = p_job_id;

  -- Withdraw credit this drive earned last time (only if untouched).
  select * into v_credit from dealer_credits where source_job_id = p_job_id;
  if found then
    if v_credit.remaining_cents < v_credit.amount_cents then
      raise exception 'The credit earned on this drive has already been used on another drive, so it cannot be recalculated.';
    end if;
    delete from dealer_credits where id = v_credit.id;
  end if;

  perform recompute_job_expense_additions(p_job_id);
  select * into j from jobs where id = p_job_id;

  if not j.final_bill_legacy then
    select * into b from compute_final_bill(p_job_id);
    v_issued := b.credit_issued_cents;
    v_pool := b.pool_cents;
    if v_issued > 0 then
      insert into dealer_credits (organization_id, source_job_id, amount_cents, remaining_cents, expires_at)
      values (j.organization_id, p_job_id, v_issued, v_issued, now() + (s.dealer_credit_expiry_days * interval '1 day'));
    end if;

    v_total := coalesce(j.estimated_dealer_cost_cents, 0) + coalesce(j.approved_expenses_cents, 0)
      + coalesce(j.admin_idle_hours_dealer_cents, 0) + coalesce(j.idle_fee_cents, 0);
    v_left := greatest(0, v_total);

    for c in
      select id, remaining_cents from dealer_credits
      where organization_id = j.organization_id
        and source_job_id <> p_job_id
        and remaining_cents > 0
        and created_at <= j.created_at
        and expires_at > j.created_at
      order by expires_at asc, created_at asc
      for update
    loop
      exit when v_left <= 0;
      v_apply := least(c.remaining_cents, v_left);
      update dealer_credits set remaining_cents = remaining_cents - v_apply where id = c.id;
      insert into dealer_credit_applications (credit_id, job_id, amount_cents) values (c.id, p_job_id, v_apply);
      v_left := v_left - v_apply;
      v_applied := v_applied + v_apply;
    end loop;
  end if;

  update jobs
  set final_bill_approved_at = now(),
      final_bill_approved_by = auth.uid(),
      final_bill_pool_cents = v_pool,
      final_bill_credit_issued_cents = v_issued,
      final_bill_credit_applied_cents = v_applied
  where id = p_job_id
  returning * into j;

  insert into job_billing_audit (job_id, changed_by, reason)
  values (p_job_id, auth.uid(),
    'Final bill approved' || case when v_issued > 0 then ' - dealer credit issued $' || (v_issued / 100.0)::numeric(10,2) else '' end
      || case when v_applied > 0 then ' - prior credit applied $' || (v_applied / 100.0)::numeric(10,2) else '' end);

  return j;
end;
$$;
grant execute on function approve_final_bill(uuid) to authenticated;

-- ============================================================
-- Driver bonus share is now adjustable (was fixed at 50%).
-- ============================================================
create or replace function compute_performance_bonus(p_job_id uuid)
returns void
language plpgsql
as $$
declare
  v_job jobs;
  v_actual_food_cents int;
  v_leftover_food_cents int;
  v_all_checklist_complete boolean;
  v_share numeric;
begin
  select * into v_job from jobs where id = p_job_id;
  if v_job is null or v_job.status <> 'completed' then
    return;
  end if;

  if v_job.performance_bonus_override_cents is not null then
    return;
  end if;

  select coalesce(driver_bonus_share_percent, 50) / 100.0 into v_share from pricing_settings where id = 1;

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
    performance_bonus_cents = round((v_leftover_food_cents * v_share)::numeric)::int
  where id = p_job_id;
end;
$$;

-- Keep jobs.approved_expenses_cents in step the moment a drive completes
-- (admin screens read it before approval).
create or replace function recompute_additions_on_completion()
returns trigger language plpgsql security definer as $$
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    perform recompute_job_expense_additions(NEW.id);
  end if;
  return NEW;
end;
$$;
drop trigger if exists recompute_additions_on_completion_trg on jobs;
create trigger recompute_additions_on_completion_trg after update on jobs
  for each row execute function recompute_additions_on_completion();

notify pgrst, 'reload schema';
