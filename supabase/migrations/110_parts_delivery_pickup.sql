insert into job_types (name, description)
  select 'Parts Delivery', 'Deliver automotive parts to a customer, dealer, or shop'
  where not exists (select 1 from job_types where name = 'Parts Delivery');

insert into job_types (name, description)
  select 'Parts Pickup', 'Pick up automotive parts from a supplier or another dealer'
  where not exists (select 1 from job_types where name = 'Parts Pickup');
