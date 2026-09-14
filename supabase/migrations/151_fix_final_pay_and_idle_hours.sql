-- 1) Fix compute_final_driver_pay(): migration 147 moved meal money out of
--    estimated_driver_pay_cents entirely (pricing.ts's computedDriverPayCents
--    no longer includes mealCostCents at all), but this trigger kept
--    subtracting baseline_food_cents anyway - a leftover from the older
--    model where meal was still baked into estimated pay and needed to be
--    stripped back out on completion. Since meal was never in the number to
--    begin with, that subtraction was just deducting the full multi-day meal
--    budget from real driver pay for no reason - on a long/overnight job
--    that easily wipes pay down to $0 or negative.
create or replace function compute_final_driver_pay()
returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'completed' and (OLD.status is distinct from 'completed') then
    NEW.final_driver_pay_cents := coalesce(NEW.estimated_driver_pay_cents, 0);
  end if;
  return NEW;
end;
$$;

-- Backfill every already-completed job with the corrected formula. Safe to
-- run for all of them: final_driver_pay_cents is purely derived (never
-- hand-edited directly - manual corrections go through
-- admin_pay_override_cents instead, which still wins over this in every
-- place driver pay is displayed), so recomputing it here can't clobber an
-- admin's override.
update jobs
set final_driver_pay_cents = coalesce(estimated_driver_pay_cents, 0)
where status = 'completed';

-- 2) Admin "add idle hours" adjustment - additive on top of whatever pay/
--    billing already applies (unlike admin_hours_override, which replaces
--    the whole hours figure). Used for cases like the customer not being
--    home at delivery, where the driver genuinely lost real time that
--    should be billed to the dealer and paid to the driver, without
--    disturbing the original booked-hours estimate on record.
alter table jobs add column if not exists admin_idle_hours_added numeric;
alter table jobs add column if not exists admin_idle_hours_dealer_cents int;
alter table jobs add column if not exists admin_idle_hours_driver_cents int;
alter table jobs add column if not exists admin_idle_hours_note text;
alter table jobs add column if not exists admin_idle_hours_added_by uuid references auth.users(id);
alter table jobs add column if not exists admin_idle_hours_added_at timestamptz;
