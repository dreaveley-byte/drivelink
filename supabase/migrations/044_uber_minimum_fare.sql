alter table pricing_settings add column if not exists uber_minimum_fare_cents int not null default 1000;
