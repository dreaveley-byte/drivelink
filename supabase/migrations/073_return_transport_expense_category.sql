-- New expense category so drivers can submit an actual receipt for the
-- Uber/bus-back reimbursement that was estimated at pricing time (e.g.
-- "Ground transport to airport", "Bus back"), so the driver card can show a
-- real approved amount instead of the pre-computed estimate.
alter table job_expenses drop constraint if exists job_expenses_category_check;
alter table job_expenses add constraint job_expenses_category_check
  check (category in ('wait_time', 'repairs', 'tolls', 'parking', 'storage', 'additional_mileage', 'fuel', 'food', 'inspection', 'return_transport', 'other'));
