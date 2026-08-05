alter table pricing_settings add column if not exists ferry_fare_cents int not null default 7500;
alter table pricing_settings add column if not exists ferry_wait_hours numeric not null default 1;
alter table jobs add column if not exists ferry_required boolean not null default false;
