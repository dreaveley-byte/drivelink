alter table jobs add column if not exists return_gps_lat double precision;
alter table jobs add column if not exists return_gps_lng double precision;
alter table jobs add column if not exists return_gps_at timestamptz;
alter table jobs add column if not exists actual_driver_hours numeric;
alter table pricing_settings add column if not exists return_location_radius_km numeric not null default 5;
