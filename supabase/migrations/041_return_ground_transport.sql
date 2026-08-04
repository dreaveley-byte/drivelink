alter table pricing_settings add column if not exists return_ground_transport_hours numeric not null default 1.5;
alter table pricing_settings add column if not exists return_ground_transport_fee_cents int not null default 3000;
