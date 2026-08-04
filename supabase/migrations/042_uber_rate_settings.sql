alter table pricing_settings add column if not exists uber_base_fare_cents int not null default 500;
alter table pricing_settings add column if not exists uber_per_km_cents int not null default 150;
