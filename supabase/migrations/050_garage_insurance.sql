alter table pricing_settings add column if not exists garage_insurance_fee_cents int not null default 5000;
alter table jobs add column if not exists use_garage_insurance boolean not null default false;
