alter table pricing_settings add column if not exists drivflo_insurance_rate_per_day_cents int not null default 3800;
alter table pricing_settings add column if not exists drivflo_insurance_multiday_discount_percent numeric not null default 15;
alter table pricing_settings add column if not exists drivflo_insurance_tow_deductible_fee_cents int not null default 5000;
alter table jobs add column if not exists include_tow_deductible_coverage boolean not null default false;
