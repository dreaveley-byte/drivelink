alter table pricing_settings add column if not exists bus_base_fare_cents int not null default 3000;
alter table pricing_settings add column if not exists bus_per_km_cents int not null default 15;
