-- Lets admin directly override the driver-paid hours on any job, at any time —
-- separate from (and takes priority over) the auto-calculated hours. When
-- set, driver pay is recomputed as override_hours * hourly_rate.
alter table jobs add column if not exists admin_hours_override numeric;
alter table jobs add column if not exists admin_hours_override_by uuid references profiles(id);
alter table jobs add column if not exists admin_hours_override_at timestamptz;
-- The computed dollar amount (hours * hourly rate at the time it was set) —
-- stored alongside the hours so every place that displays driver pay can just
-- check this one field instead of needing to fetch the hourly rate itself.
alter table jobs add column if not exists admin_pay_override_cents int;

-- Admin can add an expense directly (no driver receipt needed) as a fully
-- trusted, already-approved entry, and can delete any expense entry outright
-- (rather than just reject it) if it was added in error.
alter table job_expenses alter column receipt_photo_path drop not null;
alter table job_expenses add column if not exists added_by_admin boolean not null default false;

-- DELETE was never granted on this table before (only select/insert/update),
-- which would silently block the new admin "delete this expense" capability
-- even though the RLS policy itself permits it — same class of bug as the
-- missing job_location_pings grant found earlier.
grant delete on job_expenses to authenticated;
