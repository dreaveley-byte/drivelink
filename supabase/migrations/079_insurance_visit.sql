alter table pricing_settings add column if not exists insurance_visit_min_hours numeric not null default 1;
alter table pricing_settings add column if not exists insurance_visit_fee_cents int not null default 5000;
alter table jobs add column if not exists insurance_visit boolean not null default false;
