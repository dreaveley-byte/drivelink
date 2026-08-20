-- Parts Delivery/Parts Pickup jobs are often short hops where the normal
-- hourly formula prices out above what an Uber Courier would charge for the
-- same trip. When that happens, the app now caps the price at
-- parts_uber_discount_percent below an Uber-equivalent fare (using the
-- existing uber_base_fare_cents/uber_per_km_cents/uber_minimum_fare_cents
-- settings) and pays the driver parts_driver_pay_split_percent of what's
-- left after fuel — so Drivflo always keeps a positive margin, never a loss.
alter table pricing_settings add column if not exists parts_uber_discount_percent numeric not null default 10;
alter table pricing_settings add column if not exists parts_driver_pay_split_percent numeric not null default 80;
