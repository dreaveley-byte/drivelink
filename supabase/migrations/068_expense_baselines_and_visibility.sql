-- Baselines captured from the job's own pricing calculation at post time, so
-- fuel/inspection/food receipts can be compared against what's already priced
-- in rather than double-charging the dealer for costs already covered.
alter table jobs add column if not exists baseline_fuel_cents int not null default 0;
alter table jobs add column if not exists baseline_inspection_cents int not null default 0;
alter table jobs add column if not exists baseline_food_cents int not null default 0;

-- Records how much an approval actually added to the job's total — for fuel/
-- inspection/food this can be less than the receipt amount (or zero) once
-- baseline costs already built into the price are accounted for. Undo uses
-- this exact stored value rather than recomputing, so it can never drift.
alter table job_expenses add column if not exists approved_addition_cents int;

-- Per-dealer control over whether they can see submitted receipts/expenses at
-- all — off by default, admin can turn it on per organization.
alter table organizations add column if not exists dealer_can_view_expenses boolean not null default false;

-- Admin can fully manage (view, approve, reject) any expense.
drop policy if exists "admin and dealer review job expenses" on job_expenses;
drop policy if exists "admin manages job expenses" on job_expenses;
create policy "admin manages job expenses" on job_expenses
for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
);

-- Dealers can only ever VIEW expenses, and only if their organization has
-- been explicitly granted visibility by admin — they can never approve/reject.
drop policy if exists "dealer views job expenses if granted" on job_expenses;
create policy "dealer views job expenses if granted" on job_expenses
for select using (
  exists (
    select 1 from jobs j
    join profiles p on p.organization_id = j.organization_id
    join organizations o on o.id = j.organization_id
    where j.id = job_id and p.id = auth.uid() and p.role = 'org_admin' and o.dealer_can_view_expenses = true
  )
);
