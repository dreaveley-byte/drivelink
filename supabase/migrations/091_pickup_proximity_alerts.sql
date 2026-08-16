-- Pickup coordinates, geocoded once and cached (rather than re-geocoding on
-- every location ping, which would be wasteful), used to compute distance
-- to the pickup location for the "2 minutes away" and "driver has arrived"
-- alerts on Customer Pick Up/Drop Off jobs.
alter table jobs add column if not exists pickup_lat numeric;
alter table jobs add column if not exists pickup_lng numeric;
alter table jobs add column if not exists two_min_away_alert_sent_at timestamptz;
alter table jobs add column if not exists arrived_at_pickup_alert_sent_at timestamptz;
