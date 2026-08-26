-- Parts Delivery/Parts Pickup jobs are often short hops where the normal
-- hourly formula prices out above what an Uber Courier would charge for the
-- same trip. When that happens, the app now caps the price at
-- parts_uber_discount_percent below a parts-specific Uber-equivalent fare
-- (using parts_uber_base_fare_cents/parts_uber_per_km_cents/
-- parts_uber_minimum_fare_cents — kept separate from the existing uber_*
-- settings, which are calibrated for airport-transfer ride estimates, a
-- different real-world rate) and pays the driver parts_driver_pay_split_percent
-- of what's left after fuel — so Drivflo always keeps a positive margin,
-- never a loss.
alter table pricing_settings add column if not exists parts_uber_discount_percent numeric not null default 10;
alter table pricing_settings add column if not exists parts_driver_pay_split_percent numeric not null default 80;
alter table pricing_settings add column if not exists parts_uber_base_fare_cents int not null default 300;
alter table pricing_settings add column if not exists parts_uber_per_km_cents int not null default 92;
alter table pricing_settings add column if not exists parts_uber_minimum_fare_cents int not null default 1000;
