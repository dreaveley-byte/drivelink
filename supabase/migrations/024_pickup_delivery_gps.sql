alter table jobs add column if not exists pickup_gps_lat numeric;
alter table jobs add column if not exists pickup_gps_lng numeric;
alter table jobs add column if not exists pickup_gps_at timestamptz;
alter table jobs add column if not exists delivery_gps_lat numeric;
alter table jobs add column if not exists delivery_gps_lng numeric;
alter table jobs add column if not exists delivery_gps_at timestamptz;
