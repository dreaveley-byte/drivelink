-- Configurable radius (km) a driver must be within to actually complete a
-- job, verifying they've genuinely returned near the pickup location
-- rather than trusting an unverified tap from anywhere. Default 5km is a
-- reasonable allowance for GPS drift and being nearby without being
-- exactly on top of the original address.
alter table pricing_settings add column if not exists return_to_pickup_radius_km numeric not null default 5;
