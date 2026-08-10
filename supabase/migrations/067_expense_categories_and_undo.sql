alter table job_expenses drop constraint if exists job_expenses_category_check;
alter table job_expenses add constraint job_expenses_category_check
  check (category in ('wait_time', 'repairs', 'tolls', 'parking', 'storage', 'additional_mileage', 'fuel', 'food', 'inspection', 'other'));

alter table job_expenses add column if not exists custom_category text;
