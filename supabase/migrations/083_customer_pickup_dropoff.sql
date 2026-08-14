insert into job_types (name)
  select 'Customer Pick Up' where not exists (select 1 from job_types where name = 'Customer Pick Up');
insert into job_types (name)
  select 'Customer Drop Off' where not exists (select 1 from job_types where name = 'Customer Drop Off');

alter table jobs add column if not exists pickup_dropoff_reason text check (pickup_dropoff_reason in ('sales', 'service', 'other'));
alter table jobs add column if not exists pickup_dropoff_reason_other text;

-- Customer pick-up/drop-off rides are priced independently from vehicle
-- delivery jobs - a dealer may want a much lower (or higher) margin on a
-- quick shuttle ride than on an actual vehicle transport.
alter table pricing_settings add column if not exists customer_pickup_dropoff_markup_percent numeric not null default 128;
