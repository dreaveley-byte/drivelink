alter table jobs add column if not exists driver_lat numeric;
alter table jobs add column if not exists driver_lng numeric;
alter table jobs add column if not exists driver_location_updated_at timestamptz;
