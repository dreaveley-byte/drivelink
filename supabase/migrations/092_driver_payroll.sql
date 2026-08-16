-- Draws: advance payments taken against future earnings, recorded manually
-- by admin. Positive amount_cents = money the driver received as an advance,
-- which then gets subtracted from their next payout.
create table if not exists driver_draws (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references profiles(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  settled_at timestamptz -- set when included in a payout, so it isn't deducted twice
);
create index if not exists driver_draws_driver_id_idx on driver_draws(driver_id, settled_at);

-- Payouts: a record of admin marking a driver as paid for a given period.
-- This doesn't move any money itself right now (that's the separate Stripe
-- Connect project) - it's the "Paid" button's record of what was sent and
-- when, so a driver's outstanding balance resets correctly afterward.
create table if not exists driver_payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  earnings_cents int not null default 0,
  reimbursements_cents int not null default 0,
  draws_deducted_cents int not null default 0,
  amount_paid_cents int not null,
  notes text,
  paid_by uuid references profiles(id),
  paid_at timestamptz not null default now()
);
create index if not exists driver_payouts_driver_id_idx on driver_payouts(driver_id, paid_at desc);

-- Marks when an approved expense's reimbursement was actually included in a
-- payout, so "outstanding reimbursements" can correctly exclude it afterward.
alter table job_expenses add column if not exists reimbursement_paid_at timestamptz;
alter table job_expenses add column if not exists payout_id uuid references driver_payouts(id);

alter table driver_draws enable row level security;
alter table driver_payouts enable row level security;

drop policy if exists "admin manages driver draws" on driver_draws;
create policy "admin manages driver draws" on driver_draws
for all using (my_role() = 'platform_admin') with check (my_role() = 'platform_admin');

drop policy if exists "driver views own draws" on driver_draws;
create policy "driver views own draws" on driver_draws
for select using (driver_id = auth.uid());

drop policy if exists "admin manages driver payouts" on driver_payouts;
create policy "admin manages driver payouts" on driver_payouts
for all using (my_role() = 'platform_admin') with check (my_role() = 'platform_admin');

drop policy if exists "driver views own payouts" on driver_payouts;
create policy "driver views own payouts" on driver_payouts
for select using (driver_id = auth.uid());

grant select, insert, update, delete on driver_draws to authenticated;
grant select, insert, update, delete on driver_payouts to authenticated;

-- Returns everything needed for the admin payroll page in one call: this
-- week's earnings (Mon-Sun), outstanding (approved, unpaid) reimbursements,
-- unsettled draws, and the resulting net amount owed.
create or replace function get_driver_payroll_summary(p_week_start date)
returns table (
  driver_id uuid,
  driver_name text,
  driver_code text,
  week_earnings_cents bigint,
  outstanding_reimbursements_cents bigint,
  unsettled_draws_cents bigint,
  net_owed_cents bigint,
  month_earnings_cents bigint
)
language sql
security definer
stable
as $$
  select
    p.id,
    p.full_name,
    p.driver_code,
    coalesce((
      select sum(coalesce(final_driver_pay_cents, estimated_driver_pay_cents, 0))
      from jobs
      where driver_id = p.id and status = 'completed'
        and updated_at >= p_week_start and updated_at < p_week_start + 7
    ), 0),
    coalesce((
      select sum(amount_cents) from job_expenses
      where submitted_by = p.id and status = 'approved' and reimbursement_paid_at is null
    ), 0),
    coalesce((
      select sum(amount_cents) from driver_draws
      where driver_id = p.id and settled_at is null
    ), 0),
    coalesce((
      select sum(coalesce(final_driver_pay_cents, estimated_driver_pay_cents, 0))
      from jobs
      where driver_id = p.id and status = 'completed'
        and updated_at >= p_week_start and updated_at < p_week_start + 7
    ), 0)
    + coalesce((
      select sum(amount_cents) from job_expenses
      where submitted_by = p.id and status = 'approved' and reimbursement_paid_at is null
    ), 0)
    - coalesce((
      select sum(amount_cents) from driver_draws
      where driver_id = p.id and settled_at is null
    ), 0),
    coalesce((
      select sum(coalesce(final_driver_pay_cents, estimated_driver_pay_cents, 0))
      from jobs
      where driver_id = p.id and status = 'completed'
        and updated_at >= date_trunc('month', p_week_start) and updated_at < date_trunc('month', p_week_start) + interval '1 month'
    ), 0)
  from profiles p
  where p.role = 'driver'
  order by p.full_name;
$$;

grant execute on function get_driver_payroll_summary(date) to authenticated;

-- Marks a driver as paid for a period: records the payout, settles their
-- unsettled draws, and marks their outstanding reimbursements as paid.
create or replace function mark_driver_paid(
  p_driver_id uuid,
  p_period_start date,
  p_period_end date,
  p_earnings_cents int,
  p_reimbursements_cents int,
  p_draws_deducted_cents int,
  p_amount_paid_cents int,
  p_notes text
)
returns driver_payouts
language plpgsql
security definer
as $$
declare
  v_payout driver_payouts;
begin
  if my_role() <> 'platform_admin' then
    raise exception 'Only admin can record a payout.';
  end if;

  insert into driver_payouts (
    driver_id, period_start, period_end, earnings_cents, reimbursements_cents,
    draws_deducted_cents, amount_paid_cents, notes, paid_by
  ) values (
    p_driver_id, p_period_start, p_period_end, p_earnings_cents, p_reimbursements_cents,
    p_draws_deducted_cents, p_amount_paid_cents, p_notes, auth.uid()
  ) returning * into v_payout;

  update driver_draws set settled_at = now()
  where driver_id = p_driver_id and settled_at is null;

  update job_expenses set reimbursement_paid_at = now(), payout_id = v_payout.id
  where submitted_by = p_driver_id and status = 'approved' and reimbursement_paid_at is null;

  return v_payout;
end;
$$;

grant execute on function mark_driver_paid(uuid, date, date, int, int, int, int, text) to authenticated;
