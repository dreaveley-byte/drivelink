alter table jobs add column if not exists baseline_ferry_cents int not null default 0;

alter table job_expenses drop constraint if exists job_expenses_category_check;
alter table job_expenses add constraint job_expenses_category_check
  check (category in ('wait_time', 'repairs', 'tolls', 'parking', 'storage', 'additional_mileage', 'fuel', 'food', 'inspection', 'return_transport', 'hotel', 'charging', 'ferry', 'towing', 'other'));
