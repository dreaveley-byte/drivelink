-- New fields for the Vehicle Pick Up / Drop Off flow:
-- - pickup_dropoff_mode: 'one_way' (move a vehicle from A to B, or vice
--   versa) vs 'vehicle_exchange' (take one vehicle, bring another back -
--   no "return trip" concept applies the same way, since the driver
--   isn't coming back empty-handed).
-- - vehicle_transmission / second_vehicle_transmission: automatic or
--   manual - the driver needs to know before accepting the job whether
--   they'll need to be able to drive a manual.
alter table jobs add column if not exists pickup_dropoff_mode text check (pickup_dropoff_mode in ('one_way', 'vehicle_exchange'));
alter table jobs add column if not exists vehicle_transmission text check (vehicle_transmission in ('automatic', 'manual'));
alter table jobs add column if not exists second_vehicle_transmission text check (second_vehicle_transmission in ('automatic', 'manual'));
