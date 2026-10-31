-- Harbour Air seaplane option for jobs that cross the Strait of Georgia
-- (Vancouver <-> Victoria / Nanaimo). There's no live fare feed for Harbour
-- Air, so these are editable estimates - set them to what you actually pay.
-- Published "from" fares are about $99 (Victoria) and $59 (Nanaimo) but need
-- ~14 days' notice; same-week bookings cost more, hence the higher defaults.
alter table pricing_settings add column if not exists harbour_air_victoria_fare_cents int not null default 14900;
alter table pricing_settings add column if not exists harbour_air_nanaimo_fare_cents int not null default 10900;
alter table pricing_settings add column if not exists harbour_air_flight_minutes int not null default 35;
-- Time added around the flight: arrive, check in, board, and clear the dock.
alter table pricing_settings add column if not exists harbour_air_buffer_hours numeric not null default 1;

notify pgrst, 'reload schema';
